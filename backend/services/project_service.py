"""Project Service Layer for business logic, permissions, and validations."""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status

from dao.project_dao import project_dao
from dao.user_dao import user_dao
from database.redis import invalidate_dashboard_cache
from exceptions.domain import (
    DomainException,
    EntityNotFoundException,
    ForbiddenException,
)
import math
from models.project import Project
from models.user import User
from schemas.project_schema import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectStatus,
    PaginatedProjectsResponse,
    PaginationMeta,
)


class ProjectService:
    """Service handling project management business rules and role-based permissions."""

    async def get_projects(
        self,
        db: AsyncSession,
        current_user: User,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[ProjectOut]:
        """
        Retrieve projects based on user role:
        - Admin gets all projects across the workspace.
        - Member gets only projects assigned to them via project_members.
        """
        role = (current_user.role or "").lower()
        if role == "admin":
            projects = await project_dao.get_all_admin(
                db, status=status, category=category, search=search
            )
        else:
            projects = await project_dao.get_all_for_member(
                db, current_user.id, status=status, category=category, search=search
            )

        return [self._to_project_out(p) for p in projects]

    async def get_paginated_projects(
        self,
        db: AsyncSession,
        current_user: User,
        page: int = 1,
        page_size: int = 12,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> PaginatedProjectsResponse:
        """
        Retrieve paginated projects matching QA.md Section 5.3 API 6.
        Returns envelope with items and pagination metadata.
        """
        role = (current_user.role or "").lower()
        skip = (page - 1) * page_size

        if role == "admin":
            total_items = await project_dao.count_admin(
                db, status=status, category=category, search=search
            )
            projects = await project_dao.get_all_admin(
                db,
                status=status,
                category=category,
                search=search,
                skip=skip,
                limit=page_size,
            )
        else:
            total_items = await project_dao.count_for_member(
                db, current_user.id, status=status, category=category, search=search
            )
            projects = await project_dao.get_all_for_member(
                db,
                current_user.id,
                status=status,
                category=category,
                search=search,
                skip=skip,
                limit=page_size,
            )

        total_pages = math.ceil(total_items / page_size) if total_items > 0 else 0
        has_next_page = page < total_pages
        has_prev_page = page > 1 and total_pages > 0

        pagination_meta = PaginationMeta(
            total_items=total_items,
            page=page,
            page_size=page_size,
            totalPages=total_pages,
            has_next_page=has_next_page,
            has_prev_page=has_prev_page,
        )

        return PaginatedProjectsResponse(
            items=[self._to_project_out(p) for p in projects],
            pagination=pagination_meta,
        )

    async def get_project_by_id(
        self, db: AsyncSession, project_id: UUID, current_user: User
    ) -> ProjectOut:
        """
        Retrieve a single project by ID.
        Ensures caller has access (Admin or assigned Member).
        """
        project = await project_dao.get_by_id(db, project_id)
        if not project:
            raise EntityNotFoundException(entity_name="Project", identifier=project_id)

        role = (current_user.role or "").lower()
        if role != "admin":
            assigned_member_ids = {m.id for m in project.members}
            if current_user.id not in assigned_member_ids:
                raise ForbiddenException(detail="You do not have permission to view this project.")

        return self._to_project_out(project)

    async def create_project(
        self, db: AsyncSession, project_in: ProjectCreate, current_user: User
    ) -> ProjectOut:
        """
        Create a new project with member assignments. Restricted to Admin users.
        """
        role = (current_user.role or "").lower()
        if role != "admin":
            raise ForbiddenException(detail="Forbidden: Only Admins can create projects.")

        # Validate that all assigned memberIds exist in the workspace
        if project_in.member_ids:
            for member_id in project_in.member_ids:
                user = await user_dao.get_by_id(db, member_id)
                if not user:
                    raise DomainException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        msg="Bad Request",
                        details=f"Assigned member with ID '{member_id}' does not exist in workspace.",
                    )

        # Prepare project dictionary
        project_dict = {
            "name": project_in.name.strip(),
            "description": project_in.description.strip(),
            "status": project_in.status.value if hasattr(project_in.status, "value") else project_in.status,
            "category": project_in.category or project_in.department,
            "priority": project_in.priority.value if hasattr(project_in.priority, "value") else project_in.priority,
            "start_date": project_in.start_date,
            "due_date": project_in.due_date,
            "end_date": project_in.end_date,
            "created_by": current_user.id,
        }

        created = await project_dao.create(
            db, project_data=project_dict, member_ids=project_in.member_ids
        )
        await invalidate_dashboard_cache(str(created.id))
        return self._to_project_out(created)

    async def update_project(
        self,
        db: AsyncSession,
        project_id: UUID,
        project_in: ProjectUpdate,
        current_user: User,
    ) -> ProjectOut:
        """
        Partially update an existing project and synchronize members if provided.
        Restricted to Admin users.
        Supports updating kanban_columns to persist column order/config.
        """
        role = (current_user.role or "").lower()
        if role != "admin":
            raise ForbiddenException(detail="Forbidden: Only Admins can update projects.")

        existing = await project_dao.get_by_id(db, project_id)
        if not existing:
            raise EntityNotFoundException(entity_name="Project", identifier=project_id)

        # Validate final cross-field dates comparing incoming fields with existing records
        effective_start = (
            project_in.start_date if project_in.start_date is not None else existing.start_date
        )
        effective_due = (
            project_in.due_date if project_in.due_date is not None else existing.due_date
        )
        effective_end = (
            project_in.end_date if project_in.end_date is not None else existing.end_date
        )

        if effective_start and effective_due and effective_due < effective_start:
            raise DomainException(
                status_code=status.HTTP_400_BAD_REQUEST,
                msg="Bad Request",
                details="dueDate must be greater than or equal to startDate.",
            )

        if effective_start and effective_end and effective_end < effective_start:
            raise DomainException(
                status_code=status.HTTP_400_BAD_REQUEST,
                msg="Bad Request",
                details="endDate must be greater than or equal to startDate.",
            )

        # Validate member_ids if provided
        if project_in.member_ids is not None:
            for member_id in project_in.member_ids:
                user = await user_dao.get_by_id(db, member_id)
                if not user:
                    raise DomainException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        msg="Bad Request",
                        details=f"Assigned member with ID '{member_id}' does not exist.",
                    )

        # Build update dict from provided fields only
        update_dict = {}
        dumped = project_in.model_dump(exclude_unset=True)

        for key in ("name", "description", "category"):
            if key in dumped and dumped[key] is not None:
                update_dict[key] = dumped[key].strip() if isinstance(dumped[key], str) else dumped[key]

        for key in ("priority", "start_date", "due_date", "end_date"):
            if key in dumped:
                val = dumped[key]
                update_dict[key] = val.value if hasattr(val, "value") else val

        if "status" in dumped and dumped["status"] is not None:
            new_status = (
                dumped["status"].value
                if hasattr(dumped["status"], "value")
                else dumped["status"]
            )
            update_dict["status"] = new_status

            # Archiving: save current status as previousStatus if not already archived
            if new_status == ProjectStatus.ARCHIVED.value:
                if existing.status != ProjectStatus.ARCHIVED.value:
                    update_dict["previous_status"] = existing.status
            # Restoring: if restoring to previous status or explicit status, clear previousStatus
            elif existing.status == ProjectStatus.ARCHIVED.value:
                update_dict["previous_status"] = None

        if "previous_status" in dumped:
            val = dumped["previous_status"]
            update_dict["previous_status"] = val.value if hasattr(val, "value") else val

        # Persist kanban_columns when provided (column reorder or add/delete)
        if "kanban_columns" in dumped and dumped["kanban_columns"] is not None:
            # Convert Pydantic model instances to plain dicts for JSONB storage
            update_dict["kanban_columns"] = [
                col if isinstance(col, dict) else col.model_dump()
                for col in dumped["kanban_columns"]
            ]

        updated = await project_dao.update(
            db,
            project_id=project_id,
            update_data=update_dict,
            member_ids=project_in.member_ids,
        )
        await invalidate_dashboard_cache(str(project_id))
        return self._to_project_out(updated)

    async def delete_project(
        self, db: AsyncSession, project_id: UUID, current_user: User
    ) -> bool:
        """
        Delete a project. Restricted to Admin users.
        """
        role = (current_user.role or "").lower()
        if role != "admin":
            raise ForbiddenException(detail="Forbidden: Only Admins can delete projects.")

        existing = await project_dao.get_by_id(db, project_id)
        if not existing:
            raise EntityNotFoundException(entity_name="Project", identifier=project_id)

        deleted = await project_dao.delete(db, project_id)
        if deleted:
            await invalidate_dashboard_cache(str(project_id))
        return deleted

    @staticmethod
    def _to_project_out(project: Project) -> ProjectOut:
        """Helper to convert SQLAlchemy Project model to Pydantic ProjectOut."""
        from schemas.project_schema import ProjectMemberSummary

        from sqlalchemy import inspect
        insp = inspect(project)
        member_uuids = [m.id for m in project.members] if "members" not in insp.unloaded else []
        member_summaries = (
            [
                ProjectMemberSummary(
                    id=m.id,
                    name=m.name,
                    email=getattr(m, "email", None),
                    role=getattr(m, "role", None),
                )
                for m in project.members
            ]
            if "members" not in insp.unloaded
            else []
        )

        calc_progress = 0
        if "tasks" not in insp.unloaded:
            tasks = [t for t in (project.tasks or []) if not getattr(t, "is_deleted", False)]
            if len(tasks) > 0:
                completed_tasks = sum(1 for t in tasks if getattr(t, "status", None) == "done")
                calc_progress = round((completed_tasks / len(tasks)) * 100)

        return ProjectOut(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            category=project.category,
            priority=project.priority,
            start_date=project.start_date,
            due_date=project.due_date,
            end_date=project.end_date,
            previous_status=project.previous_status,
            is_deleted=project.is_deleted,
            progress=calc_progress,
            created_by=project.created_by,
            created_at=project.created_at,
            updated_at=project.updated_at,
            member_ids=member_uuids,
            members=member_summaries,
            kanban_columns=project.kanban_columns or [],
        )


# Shared singleton instance
project_service = ProjectService()
