"""Project Data Access Object (DAO) for database operations."""

from typing import Any, Dict, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from dao.base_dao import BaseDAO
from models.project import Project, ProjectMember


class ProjectDAO(BaseDAO[Project]):
    """Data Access Object for Project database operations."""

    def __init__(self):
        super().__init__(Project)

    async def get_all_admin(
        self,
        db: AsyncSession,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        skip: Optional[int] = None,
        limit: Optional[int] = None,
        include_deleted: bool = False,
    ) -> List[Project]:
        """
        Retrieve all projects in the workspace with members eager-loaded.
        By default excludes soft-deleted projects.
        """
        query = select(Project).options(selectinload(Project.members), selectinload(Project.tasks))
        if not include_deleted:
            query = query.where(Project.is_deleted == False)
        if status and status.strip():
            query = query.where(Project.status.ilike(status.strip()))
        if category and category.strip():
            query = query.where(Project.category.ilike(category.strip()))
        if search and search.strip():
            query = query.where(Project.name.ilike(f"%{search.strip()}%"))

        query = query.order_by(Project.created_at.desc())
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def count_admin(
        self,
        db: AsyncSession,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count total matching projects for admin."""
        from sqlalchemy import func
        query = select(func.count(Project.id))
        if not include_deleted:
            query = query.where(Project.is_deleted == False)
        if status and status.strip():
            query = query.where(Project.status.ilike(status.strip()))
        if category and category.strip():
            query = query.where(Project.category.ilike(category.strip()))
        if search and search.strip():
            query = query.where(Project.name.ilike(f"%{search.strip()}%"))

        result = await db.execute(query)
        return result.scalar() or 0

    async def get_all_for_member(
        self,
        db: AsyncSession,
        user_id: UUID,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        skip: Optional[int] = None,
        limit: Optional[int] = None,
        include_deleted: bool = False,
    ) -> List[Project]:
        """
        Retrieve only projects assigned to the given member ID.
        Uses a SQL join on project_members so unassigned projects are never exposed.
        By default excludes soft-deleted projects.
        """
        query = (
            select(Project)
            .join(ProjectMember, Project.id == ProjectMember.project_id)
            .where(ProjectMember.user_id == user_id)
            .options(selectinload(Project.members), selectinload(Project.tasks))
            .distinct()
        )
        if not include_deleted:
            query = query.where(Project.is_deleted == False)
        if status and status.strip():
            query = query.where(Project.status.ilike(status.strip()))
        if category and category.strip():
            query = query.where(Project.category.ilike(category.strip()))
        if search and search.strip():
            query = query.where(Project.name.ilike(f"%{search.strip()}%"))

        query = query.order_by(Project.created_at.desc())
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def count_for_member(
        self,
        db: AsyncSession,
        user_id: UUID,
        status: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count total matching projects for assigned member."""
        from sqlalchemy import func
        query = (
            select(func.count(Project.id.distinct()))
            .join(ProjectMember, Project.id == ProjectMember.project_id)
            .where(ProjectMember.user_id == user_id)
        )
        if not include_deleted:
            query = query.where(Project.is_deleted == False)
        if status and status.strip():
            query = query.where(Project.status.ilike(status.strip()))
        if category and category.strip():
            query = query.where(Project.category.ilike(category.strip()))
        if search and search.strip():
            query = query.where(Project.name.ilike(f"%{search.strip()}%"))

        result = await db.execute(query)
        return result.scalar() or 0

    async def get_by_id(
        self, db: AsyncSession, project_id: UUID, include_deleted: bool = False
    ) -> Optional[Project]:
        """
        Retrieve a single project by ID with members eager-loaded.
        By default returns None if the project is soft-deleted.
        """
        query = (
            select(Project)
            .where(Project.id == project_id)
            .options(selectinload(Project.members), selectinload(Project.tasks))
        )
        if not include_deleted:
            query = query.where(Project.is_deleted == False)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        project_data: Dict[str, Any],
        member_ids: Optional[List[UUID]] = None,
    ) -> Project:
        """
        Create a new project and insert member assignment rows in a single transaction.
        """
        # Exclude member_ids / memberIds if accidentally present in project_data dictionary
        clean_data = {k: v for k, v in project_data.items() if k not in ("member_ids", "memberIds")}

        project = Project(**clean_data)
        db.add(project)
        await db.flush()  # Generate project.id without committing transaction yet

        # Insert assigned members if provided
        if member_ids:
            # Deduplicate member_ids while preserving order
            unique_member_ids = list(dict.fromkeys(member_ids))
            for uid in unique_member_ids:
                assignment = ProjectMember(project_id=project.id, user_id=uid)
                db.add(assignment)

        await db.commit()
        # Reload with members eager-loaded
        return await self.get_by_id(db, project.id)

    async def update(
        self,
        db: AsyncSession,
        project_id: UUID,
        update_data: Dict[str, Any],
        member_ids: Optional[List[UUID]] = None,
    ) -> Optional[Project]:
        """
        Update project fields and synchronize member assignments if provided.
        Returns None if project not found.
        """
        project = await self.get_by_id(db, project_id)
        if not project:
            return None

        # Clean project columns
        clean_updates = {k: v for k, v in update_data.items() if k not in ("member_ids", "memberIds")}
        for field, value in clean_updates.items():
            if hasattr(project, field):
                setattr(project, field, value)

        # Synchronize member assignments only if member_ids was explicitly provided (not None)
        if member_ids is not None:
            # Delete old assignments
            await db.execute(delete(ProjectMember).where(ProjectMember.project_id == project_id))

            # Add new assignments (deduplicated)
            unique_member_ids = list(dict.fromkeys(member_ids))
            for uid in unique_member_ids:
                assignment = ProjectMember(project_id=project_id, user_id=uid)
                db.add(assignment)

        await db.commit()
        db.expire(project, ["members"])
        return await self.get_by_id(db, project_id)

    async def delete(self, db: AsyncSession, project_id: UUID) -> bool:
        """
        Soft-delete a project by marking is_deleted = True.
        Returns True if updated, False if not found.
        """
        project = await self.get_by_id(db, project_id, include_deleted=False)
        if not project:
            return False

        project.is_deleted = True
        db.add(project)
        await db.commit()
        return True


# Shared singleton instance
project_dao = ProjectDAO()
