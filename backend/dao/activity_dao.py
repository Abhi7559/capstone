"""Project Activity Data Access Object (DAO) for activity feed operations."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from dao.base_dao import BaseDAO
from models.activity import ProjectActivity


class ActivityDAO(BaseDAO[ProjectActivity]):
    """Data Access Object for ProjectActivity operations."""

    def __init__(self):
        super().__init__(ProjectActivity)

    async def create_project_activity(
        self,
        db: AsyncSession,
        *,
        project_id: UUID,
        task_id: UUID,
        task_title: str,
        user_name: str,
        from_status: str,
        to_status: str,
        user_id: Optional[UUID] = None,
    ) -> ProjectActivity:
        """
        Create and persist a project activity log entry.
        Records status transitions, author details, and parent project association.
        """
        from datetime import datetime, timezone

        activity = ProjectActivity(
            project_id=project_id,
            task_id=task_id,
            task_title=task_title,
            user_id=user_id,
            user_name=user_name,
            from_status=from_status,
            to_status=to_status,
            created_at=datetime.now(timezone.utc),
        )
        db.add(activity)
        await db.commit()
        await db.refresh(activity)
        return activity

    async def get_by_project(
        self,
        db: AsyncSession,
        project_id: UUID,
        skip: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> List[ProjectActivity]:
        """
        Retrieve all activity records for a given project in descending order of creation time.
        """
        query = (
            select(ProjectActivity)
            .where(ProjectActivity.project_id == project_id)
            .order_by(ProjectActivity.created_at.desc(), ProjectActivity.id.desc())
        )
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_recent_global(
        self,
        db: AsyncSession,
        limit: int = 10,
    ) -> List[ProjectActivity]:
        """
        Retrieve the most recent activity records globally across all active projects.
        Ordered newest first, limited to the specified count.
        """
        query = (
            select(ProjectActivity)
            .order_by(ProjectActivity.created_at.desc(), ProjectActivity.id.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_recent_for_projects(
        self,
        db: AsyncSession,
        project_ids: List[UUID],
        limit: int = 10,
    ) -> List[ProjectActivity]:
        """
        Retrieve the most recent activity records for a specific set of projects.
        Ordered newest first, limited to the specified count.
        """
        if not project_ids:
            return []

        query = (
            select(ProjectActivity)
            .where(ProjectActivity.project_id.in_(project_ids))
            .order_by(ProjectActivity.created_at.desc(), ProjectActivity.id.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_completions_over_interval(
        self,
        db: AsyncSession,
        *,
        start_datetime: datetime,
        end_datetime: datetime,
        project_id: Optional[UUID] = None,
        allowed_project_ids: Optional[List[UUID]] = None,
    ) -> List[ProjectActivity]:
        """
        Query status transition activities where to_status == 'done'
        within the given time window [start_datetime, end_datetime].
        """
        query = (
            select(ProjectActivity)
            .where(
                ProjectActivity.to_status == "done",
                ProjectActivity.created_at >= start_datetime,
                ProjectActivity.created_at <= end_datetime,
            )
            .order_by(ProjectActivity.created_at.asc())
        )
        if project_id is not None:
            query = query.where(ProjectActivity.project_id == project_id)
        elif allowed_project_ids is not None:
            if not allowed_project_ids:
                return []
            query = query.where(ProjectActivity.project_id.in_(allowed_project_ids))

        result = await db.execute(query)
        return list(result.scalars().all())


# Shared singleton instance
activity_dao = ActivityDAO()
