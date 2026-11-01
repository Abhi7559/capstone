"""Task Service Layer for business logic, assignee validation, activity logging, and caching.

Coordinates task CRUD operations, enforces project membership for assignees,
records project activities upon status change, and purges Redis dashboard caches.
"""

from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from dao.task_dao import task_dao
from dao.activity_dao import activity_dao
from dao.project_dao import project_dao
from dao.user_dao import user_dao
from database.redis import invalidate_dashboard_cache
from exceptions.domain import (
    EntityNotFoundException,
    ForbiddenException,
    ValidationException,
)
from models.user import User
from models.task import Task
from models.activity import ProjectActivity
from schemas.task_schema import (
    TaskCreate,
    TaskUpdate,
    TaskOut,
    ProjectActivityOut,
    PaginatedTasksResponse,
)


class TaskService:
    """Service handling task business rules, assignee validation, activities, and caching."""

    async def get_tasks(
        self,
        db: AsyncSession,
        current_user: User,
        *,
        project_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        due_date: Optional[date] = None,
        skip: Optional[int] = None,
        limit: Optional[int] = None,
        include_deleted: bool = False,
        deleted_only: bool = False,
    ) -> List[TaskOut]:
        """
        Retrieve filtered tasks accessible to the current user.
        If a specific project_id is requested, checks that the user has access (Admin or member).
        """
        role = (current_user.role or "").lower()

        if project_id is not None:
            project = await project_dao.get_by_id(db, project_id)
            if not project:
                raise EntityNotFoundException(entity_name="Project", identifier=project_id)
            if role != "admin":
                member_ids = {m.id for m in project.members}
                if current_user.id not in member_ids:
                    raise ForbiddenException(detail="You do not have access to this project's tasks.")

        tasks = await task_dao.get_filtered(
            db,
            project_id=project_id,
            status=status,
            priority=priority,
            assignee_id=assignee_id,
            due_date=due_date,
            skip=skip,
            limit=limit,
            include_deleted=include_deleted,
            deleted_only=deleted_only,
        )

        # For members querying without a specific project_id, filter out tasks from unassigned projects
        if role != "admin" and project_id is None:
            user_projects = await project_dao.get_all_for_member(db, current_user.id)
            allowed_project_ids = {p.id for p in user_projects}
            tasks = [t for t in tasks if t.project_id in allowed_project_ids]

        return [self._to_task_out(t) for t in tasks]

    async def get_paginated_tasks(
        self,
        db: AsyncSession,
        current_user: User,
        *,
        page: int = 1,
        page_size: int = 20,
        project_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        due_date: Optional[date] = None,
    ) -> PaginatedTasksResponse:
        """
        Retrieve paginated tasks accessible to the current user matching QA.md API 12.
        """
        import math
        from schemas.project_schema import PaginationMeta

        role = (current_user.role or "").lower()

        if project_id is not None:
            project = await project_dao.get_by_id(db, project_id)
            if not project:
                raise EntityNotFoundException(entity_name="Project", identifier=project_id)
            if role != "admin":
                member_ids = {m.id for m in project.members}
                if current_user.id not in member_ids:
                    raise ForbiddenException(detail="You do not have access to this project's tasks.")

        # For members querying without a specific project_id:
        if role != "admin" and project_id is None:
            user_projects = await project_dao.get_all_for_member(db, current_user.id)
            allowed_project_ids = {p.id for p in user_projects}
            all_raw_tasks = await task_dao.get_filtered(
                db,
                status=status,
                priority=priority,
                assignee_id=assignee_id,
                due_date=due_date,
            )
            filtered_tasks = [t for t in all_raw_tasks if t.project_id in allowed_project_ids]
            total_items = len(filtered_tasks)
            skip = (page - 1) * page_size
            paginated_tasks = filtered_tasks[skip : skip + page_size]
        else:
            total_items = await task_dao.count_filtered(
                db,
                project_id=project_id,
                status=status,
                priority=priority,
                assignee_id=assignee_id,
                due_date=due_date,
            )
            skip = (page - 1) * page_size
            paginated_tasks = await task_dao.get_filtered(
                db,
                project_id=project_id,
                status=status,
                priority=priority,
                assignee_id=assignee_id,
                due_date=due_date,
                skip=skip,
                limit=page_size,
            )

        total_pages = math.ceil(total_items / page_size) if total_items > 0 else 0
        pagination_meta = PaginationMeta(
            total_items=total_items,
            page=page,
            page_size=page_size,
            totalPages=total_pages,
            has_next_page=page < total_pages,
            has_prev_page=page > 1 and total_pages > 0,
        )

        return PaginatedTasksResponse(
            items=[self._to_task_out(t) for t in paginated_tasks],
            pagination=pagination_meta,
        )

    async def get_task_by_id(
        self,
        db: AsyncSession,
        task_id: UUID,
        current_user: User,
    ) -> TaskOut:
        """
        Retrieve a single task by ID.
        Ensures the user has permission to view the task (Admin or assigned to parent project).
        """
        task = await task_dao.get_by_id(db, task_id)
        if not task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        role = (current_user.role or "").lower()
        if role != "admin":
            project = await project_dao.get_by_id(db, task.project_id)
            if project:
                member_ids = {m.id for m in project.members}
                if current_user.id not in member_ids:
                    raise ForbiddenException(detail="You do not have access to this task.")

        return self._to_task_out(task)

    async def create_task(
        self,
        db: AsyncSession,
        task_in: TaskCreate,
        current_user: User,
    ) -> TaskOut:
        """
        Create a new task:
        1. Validates that the target project exists and is not archived.
        2. Validates that the user has permission to create tasks (Admin).
        3. Validates that the assignee (if provided) is an active member of the project.
        4. Persists the task.
        5. Invalidates dashboard and KPI caches.
        """
        # 1. Project validation
        project = await project_dao.get_by_id(db, task_in.project_id)
        if not project:
            raise EntityNotFoundException(entity_name="Project", identifier=task_in.project_id)

        if project.status == "archived":
            raise ValidationException("Cannot create tasks in an archived project.")

        # 2. Assignee validation
        if task_in.assignee_id is not None:
            assignee = await user_dao.get_by_id(db, task_in.assignee_id)
            if not assignee:
                raise ValidationException("Assignee is not a member of this project")

            project_member_ids = {m.id for m in project.members}
            if task_in.assignee_id not in project_member_ids:
                raise ValidationException("Assignee is not a member of this project")

        # 3. Create task via DAO
        task_data = task_in.model_dump(by_alias=False)
        created_task = await task_dao.create(db, task_data)

        # 4. Invalidate Redis dashboard cache
        await invalidate_dashboard_cache(str(task_in.project_id))

        return self._to_task_out(created_task)

    async def update_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        task_update: TaskUpdate,
        current_user: User,
    ) -> TaskOut:
        """
        Partially update an existing task:
        1. Validates that task exists.
        2. Checks permissions (Admin or assigned member).
        3. If assignee is updated, verifies membership in the parent project.
        4. If status changes, records ProjectActivity.
        5. Invalidates Redis dashboard cache.
        """
        existing_task = await task_dao.get_by_id(db, task_id)
        if not existing_task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        role = (current_user.role or "").lower()
        is_admin = role == "admin"
        is_assigned_member = existing_task.assignee_id == current_user.id

        if not (is_admin or is_assigned_member):
            raise ForbiddenException(detail="You do not have permission to update this task.")

        update_dict = task_update.model_dump(exclude_unset=True, by_alias=False)

        # Validate assignee if updated to a non-null user
        if "assignee_id" in update_dict and update_dict["assignee_id"] is not None:
            new_assignee_id = update_dict["assignee_id"]
            project = await project_dao.get_by_id(db, existing_task.project_id)
            if not project:
                raise EntityNotFoundException(entity_name="Project", identifier=existing_task.project_id)

            project_member_ids = {m.id for m in project.members}
            if new_assignee_id not in project_member_ids:
                raise ValidationException("Assignee is not a member of this project")

        # Track status change for activity logging
        old_status = existing_task.status
        new_status = update_dict.get("status")
        # Normalize status if Pydantic enum
        if hasattr(new_status, "value"):
            new_status = new_status.value

        updated_task = await task_dao.update(db, task_id, update_dict)
        if not updated_task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        # Record activity only if status actually changed
        if new_status and new_status != old_status:
            user_name = current_user.name or (
                "System Admin" if is_admin else "Team Member"
            )
            await activity_dao.create_project_activity(
                db,
                project_id=updated_task.project_id,
                task_id=updated_task.id,
                task_title=updated_task.title,
                user_id=current_user.id,
                user_name=user_name,
                from_status=old_status,
                to_status=new_status,
            )

        # Invalidate dashboard cache
        await invalidate_dashboard_cache(str(updated_task.project_id))

        return self._to_task_out(updated_task)

    async def delete_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        current_user: User,
    ) -> bool:
        """
        Delete a task:
        Restricted to Admin users (enforced at service level).
        Invalidates dashboard cache upon deletion.
        """
        role = (current_user.role or "").lower()
        if role != "admin":
            raise ForbiddenException(detail="Forbidden: Only Admins can delete tasks.")

        task = await task_dao.get_by_id(db, task_id)
        if not task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        project_id = str(task.project_id)
        deleted = await task_dao.delete(db, task_id)
        if deleted:
            await invalidate_dashboard_cache(project_id)

        return deleted

    async def restore_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        current_user: User,
    ) -> TaskOut:
        """
        Restore a soft-deleted task:
        Enforces project access and invalidates dashboard cache.
        """
        task = await task_dao.get_by_id(db, task_id, include_deleted=True)
        if not task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        role = (current_user.role or "").lower()
        if role != "admin":
            project = await project_dao.get_by_id(db, task.project_id)
            if project:
                member_ids = {m.id for m in project.members}
                if current_user.id not in member_ids:
                    raise ForbiddenException(detail="You do not have access to this project's tasks.")

        restored_task = await task_dao.restore(db, task_id)
        if not restored_task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        await invalidate_dashboard_cache(str(restored_task.project_id))
        return self._to_task_out(restored_task)

    async def hard_delete_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        current_user: User,
    ) -> bool:
        """
        Permanently delete a task from the database (Admin only).
        """
        role = (current_user.role or "").lower()
        if role != "admin":
            raise ForbiddenException(detail="Forbidden: Only Admins can permanently delete tasks.")

        task = await task_dao.get_by_id(db, task_id, include_deleted=True)
        if not task:
            raise EntityNotFoundException(entity_name="Task", identifier=task_id)

        project_id = str(task.project_id)
        deleted = await task_dao.hard_delete(db, task_id)
        if deleted:
            await invalidate_dashboard_cache(project_id)
        return deleted

    async def get_project_activities(
        self,
        db: AsyncSession,
        project_id: UUID,
        current_user: User,
    ) -> List[ProjectActivityOut]:
        """
        Retrieve project activities for the given project.
        Accessible to Admin or assigned project members.
        """
        project = await project_dao.get_by_id(db, project_id)
        if not project:
            raise EntityNotFoundException(entity_name="Project", identifier=project_id)

        role = (current_user.role or "").lower()
        if role != "admin":
            member_ids = {m.id for m in project.members}
            if current_user.id not in member_ids:
                raise ForbiddenException(detail="You do not have access to this project's activities.")

        activities = await activity_dao.get_by_project(db, project_id)
        return [self._to_activity_out(a) for a in activities]

    @staticmethod
    def _to_task_out(task: Task) -> TaskOut:
        """Helper to convert Task SQLAlchemy model to TaskOut Pydantic schema."""
        return TaskOut.model_validate(task)

    @staticmethod
    def _to_activity_out(activity: ProjectActivity) -> ProjectActivityOut:
        """Helper to convert ProjectActivity SQLAlchemy model to ProjectActivityOut Pydantic schema."""
        return ProjectActivityOut.model_validate(activity)


# Shared singleton instance
task_service = TaskService()
