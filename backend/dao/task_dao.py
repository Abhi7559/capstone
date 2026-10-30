"""Task Data Access Object (DAO) for database operations."""

from datetime import date
from typing import Any, Dict, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload

from dao.base_dao import BaseDAO
from models.task import Task


class TaskDAO(BaseDAO[Task]):
    """Data Access Object for Task database operations."""

    def __init__(self):
        super().__init__(Task)

    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        due_date: Optional[date] = None,
        skip: Optional[int] = None,
        limit: Optional[int] = None,
        include_deleted: bool = False,
    ) -> List[Task]:
        """
        Retrieve tasks with dynamic filters and eager loading.
        Tasks are ordered by created_at descending.
        Excludes soft-deleted tasks by default.
        """
        query = select(Task).options(selectinload(Task.assignee))

        if not include_deleted:
            query = query.where(Task.is_deleted == False)

        if project_id is not None:
            query = query.where(Task.project_id == project_id)

        if status and status.strip():
            query = query.where(Task.status.ilike(status.strip()))

        if priority and priority.strip():
            query = query.where(Task.priority.ilike(priority.strip()))

        if assignee_id is not None:
            query = query.where(Task.assignee_id == assignee_id)

        if due_date is not None:
            query = query.where(Task.due_date == due_date)

        query = query.order_by(Task.created_at.desc())

        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        due_date: Optional[date] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count total tasks matching filter criteria (for pagination)."""
        query = select(func.count(Task.id))

        if not include_deleted:
            query = query.where(Task.is_deleted == False)

        if project_id is not None:
            query = query.where(Task.project_id == project_id)

        if status and status.strip():
            query = query.where(Task.status.ilike(status.strip()))

        if priority and priority.strip():
            query = query.where(Task.priority.ilike(priority.strip()))

        if assignee_id is not None:
            query = query.where(Task.assignee_id == assignee_id)

        if due_date is not None:
            query = query.where(Task.due_date == due_date)

        result = await db.execute(query)
        return result.scalar() or 0

    async def count_overdue(
        self,
        db: AsyncSession,
        *,
        today: date,
        assignee_id: Optional[UUID] = None,
        include_deleted: bool = False,
    ) -> int:
        """
        Count overdue tasks: due_date < today AND status != 'done'.
        Optionally filtered by assignee_id. Excludes soft-deleted tasks by default.
        """
        query = select(func.count(Task.id)).where(
            Task.due_date < today,
            Task.status != "done",
        )
        if not include_deleted:
            query = query.where(Task.is_deleted == False)
        if assignee_id is not None:
            query = query.where(Task.assignee_id == assignee_id)

        result = await db.execute(query)
        return result.scalar() or 0

    async def get_overdue_tasks(
        self,
        db: AsyncSession,
        *,
        today: date,
        assignee_id: Optional[UUID] = None,
        include_deleted: bool = False,
    ) -> List[Task]:
        """
        Retrieve overdue tasks: due_date < today AND status != 'done'.
        Ordered by due_date ascending. Excludes soft-deleted tasks by default.
        """
        query = (
            select(Task)
            .options(selectinload(Task.assignee))
            .where(
                Task.due_date < today,
                Task.status != "done",
            )
        )
        if not include_deleted:
            query = query.where(Task.is_deleted == False)
        if assignee_id is not None:
            query = query.where(Task.assignee_id == assignee_id)

        query = query.order_by(Task.due_date.asc(), Task.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_tasks_due_soon(
        self,
        db: AsyncSession,
        *,
        start_date: date,
        end_date: date,
        assignee_id: Optional[UUID] = None,
        include_deleted: bool = False,
    ) -> List[Task]:
        """
        Retrieve tasks with due_date between start_date and end_date (inclusive),
        excluding completed tasks (status != 'done').
        Ordered by due_date ascending.
        """
        query = (
            select(Task)
            .options(selectinload(Task.assignee))
            .where(
                Task.due_date >= start_date,
                Task.due_date <= end_date,
                Task.status != "done",
            )
        )
        if not include_deleted:
            query = query.where(Task.is_deleted == False)
        if assignee_id is not None:
            query = query.where(Task.assignee_id == assignee_id)

        query = query.order_by(Task.due_date.asc(), Task.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_status_distribution(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        allowed_project_ids: Optional[List[UUID]] = None,
        include_deleted: bool = False,
    ) -> Dict[str, int]:
        """
        Aggregate task counts grouped by status in SQL.
        Optionally filtered by project_id or scoped to allowed_project_ids.
        """
        query = select(Task.status, func.count(Task.id)).group_by(Task.status)
        if not include_deleted:
            query = query.where(Task.is_deleted == False)

        if project_id is not None:
            query = query.where(Task.project_id == project_id)
        elif allowed_project_ids is not None:
            if not allowed_project_ids:
                return {}
            query = query.where(Task.project_id.in_(allowed_project_ids))

        result = await db.execute(query)
        return {str(row[0]).lower(): int(row[1]) for row in result.all()}

    async def get_workload_by_assignee(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        allowed_project_ids: Optional[List[UUID]] = None,
        include_deleted: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Aggregate task workload per assignee in SQL.
        Returns list of dicts with assignee_id, assignee_name, and count.
        """
        from models.user import User

        query = (
            select(
                Task.assignee_id,
                User.name.label("assignee_name"),
                func.count(Task.id).label("task_count"),
            )
            .outerjoin(User, Task.assignee_id == User.id)
            .group_by(Task.assignee_id, User.name)
        )
        if not include_deleted:
            query = query.where(Task.is_deleted == False)

        if project_id is not None:
            query = query.where(Task.project_id == project_id)
        elif allowed_project_ids is not None:
            if not allowed_project_ids:
                return []
            query = query.where(Task.project_id.in_(allowed_project_ids))

        result = await db.execute(query)
        workload = []
        for row in result.all():
            a_id, a_name, count = row[0], row[1], row[2]
            workload.append({
                "assignee_id": a_id,
                "assignee_name": a_name if a_name else "Unassigned",
                "count": int(count),
            })
        return workload

    async def get_by_id(
        self,
        db: AsyncSession,
        task_id: UUID,
        include_deleted: bool = False,
    ) -> Optional[Task]:
        """Retrieve a single task by its primary key with assignee eager loaded."""
        query = (
            select(Task)
            .where(Task.id == task_id)
            .options(selectinload(Task.assignee))
        )
        if not include_deleted:
            query = query.where(Task.is_deleted == False)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        task_data: Dict[str, Any],
    ) -> Task:
        """
        Create a new task.
        Extracts snake_case fields, handles JSON tags, flushes, commits,
        and returns the created task.
        """
        # Map camelCase keys to snake_case if passed as camelCase
        clean_data = {}
        for k, v in task_data.items():
            if k == "projectId":
                clean_data["project_id"] = v
            elif k == "assigneeId":
                clean_data["assignee_id"] = v
            elif k == "dueDate":
                clean_data["due_date"] = v
            else:
                clean_data[k] = v

        # Normalize enum instances to string values if applicable
        if hasattr(clean_data.get("status"), "value"):
            clean_data["status"] = clean_data["status"].value
        if hasattr(clean_data.get("priority"), "value"):
            clean_data["priority"] = clean_data["priority"].value

        # Ensure tags is a list
        if "tags" in clean_data and clean_data["tags"] is None:
            clean_data["tags"] = []

        task = Task(**clean_data)
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task

    async def update(
        self,
        db: AsyncSession,
        task_id: UUID,
        update_data: Dict[str, Any],
    ) -> Optional[Task]:
        """
        Partially update an existing task.
        Only fields present in update_data are modified; omitted fields remain unchanged.
        Explicit None values (e.g. assignee_id: None) are respected.
        """
        task = await self.get_by_id(db, task_id)
        if not task:
            return None

        for field, value in update_data.items():
            # Translate possible camelCase keys
            attr_name = field
            if field == "projectId":
                attr_name = "project_id"
            elif field == "assigneeId":
                attr_name = "assignee_id"
            elif field == "dueDate":
                attr_name = "due_date"

            if hasattr(task, attr_name):
                # Normalize Enum values to raw string if needed
                val = value.value if hasattr(value, "value") else value
                setattr(task, attr_name, val)

        await db.commit()
        await db.refresh(task)
        return task

    async def delete(self, db: AsyncSession, task_id: UUID) -> bool:
        """
        Soft-delete a task by setting is_deleted = True.
        Returns True if deleted, False if task does not exist.
        """
        task = await self.get_by_id(db, task_id, include_deleted=False)
        if not task:
            return False

        task.is_deleted = True
        db.add(task)
        await db.commit()
        return True


# Shared singleton instance
task_dao = TaskDAO()
