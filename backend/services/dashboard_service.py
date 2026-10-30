"""Dashboard Service Layer for computing role-specific metrics.

Implements business logic for:
- Admin workspace overview (total projects, total tasks, completed, overdue, recently created tasks, global activity).
- Member personal workspace overview (my assigned tasks, my overdue tasks, tasks due soon, my projects, member activity).
"""

from datetime import datetime, timezone, timedelta
from typing import List, Union
from sqlalchemy.ext.asyncio import AsyncSession

from dao.project_dao import project_dao
from dao.task_dao import task_dao
from dao.activity_dao import activity_dao
from models.user import User
from models.activity import ProjectActivity
from schemas.dashboard_schema import (
    AdminDashboardData,
    MemberDashboardData,
    ActivityItem,
)
from schemas.task_schema import TaskOut
from schemas.project_schema import ProjectOut
from services.project_service import project_service


class DashboardService:
    """Service handling dashboard aggregation and metrics assembly."""

    async def get_dashboard_stats(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> Union[AdminDashboardData, MemberDashboardData]:
        """
        Return role-tailored dashboard data:
        - Admin callers receive global workspace metrics.
        - Member callers receive their own personal assigned tasks and assigned projects.
        """
        role = (current_user.role or "").lower()
        if role == "admin":
            return await self.get_admin_dashboard(db)
        return await self.get_member_dashboard(db, current_user)

    async def get_admin_dashboard(
        self,
        db: AsyncSession,
    ) -> AdminDashboardData:
        """
        Compute workspace-wide metrics for Admin users:
        1. totalProjects: count all active (non-deleted) projects.
        2. totalTasks: count all non-deleted tasks.
        3. completedTasks: count tasks with status == 'done'.
        4. overdueTasks: count non-deleted tasks with due_date < today and status != 'done'.
        5. recentlyCreatedTasks: 5 most recently created tasks (newest first).
        6. recentActivity: 10 most recent global activity records.
        """
        today = datetime.now(timezone.utc).date()

        # Database-level aggregations
        total_projects = await project_dao.count_admin(db, include_deleted=False)
        total_tasks = await task_dao.count_filtered(db, include_deleted=False)
        completed_tasks = await task_dao.count_filtered(
            db, status="done", include_deleted=False
        )
        overdue_tasks = await task_dao.count_overdue(
            db, today=today, include_deleted=False
        )

        # 5 most recently created tasks
        raw_recent_tasks = await task_dao.get_filtered(
            db,
            skip=0,
            limit=5,
            include_deleted=False,
        )
        recently_created_tasks = [TaskOut.model_validate(t) for t in raw_recent_tasks]

        # 10 most recent global activities
        raw_activities = await activity_dao.get_recent_global(db, limit=10)
        recent_activity = [self._to_activity_item(a) for a in raw_activities]

        return AdminDashboardData(
            total_projects=total_projects,
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            overdue_tasks=overdue_tasks,
            recently_created_tasks=recently_created_tasks,
            recent_activity=recent_activity,
        )

    async def get_member_dashboard(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> MemberDashboardData:
        """
        Compute personal workspace metrics for Member users:
        1. myAssignedTasks: all non-deleted tasks assigned to current_user.id.
        2. myOverdueTasks: tasks assigned to current_user.id with due_date < today and status != 'done'.
        3. tasksDueSoon: tasks assigned to current_user.id due within next 72 hours (today <= due_date <= today + 3 days) and status != 'done'.
        4. myProjects: projects where current_user is assigned via project_members.
        5. recentActivity: 10 most recent activity records from member's assigned projects.
        """
        today = datetime.now(timezone.utc).date()
        due_soon_end = (datetime.now(timezone.utc) + timedelta(hours=72)).date()

        # 1. Member's assigned tasks
        raw_assigned_tasks = await task_dao.get_filtered(
            db,
            assignee_id=current_user.id,
            include_deleted=False,
        )
        my_assigned_tasks = [TaskOut.model_validate(t) for t in raw_assigned_tasks]

        # 2. Member's overdue tasks
        raw_overdue_tasks = await task_dao.get_overdue_tasks(
            db,
            today=today,
            assignee_id=current_user.id,
            include_deleted=False,
        )
        my_overdue_tasks = [TaskOut.model_validate(t) for t in raw_overdue_tasks]

        # 3. Tasks due soon (within 72 hours)
        raw_due_soon = await task_dao.get_tasks_due_soon(
            db,
            start_date=today,
            end_date=due_soon_end,
            assignee_id=current_user.id,
            include_deleted=False,
        )
        tasks_due_soon = [TaskOut.model_validate(t) for t in raw_due_soon]

        # 4. Member's assigned projects
        raw_projects = await project_dao.get_all_for_member(
            db,
            user_id=current_user.id,
            include_deleted=False,
        )
        my_projects = [project_service._to_project_out(p) for p in raw_projects]

        # 5. Member-relevant activity (scoped to member's projects)
        member_project_ids = [p.id for p in raw_projects]
        raw_activities = await activity_dao.get_recent_for_projects(
            db,
            project_ids=member_project_ids,
            limit=10,
        )
        recent_activity = [self._to_activity_item(a) for a in raw_activities]

        return MemberDashboardData(
            my_assigned_tasks=my_assigned_tasks,
            my_overdue_tasks=my_overdue_tasks,
            tasks_due_soon=tasks_due_soon,
            my_projects=my_projects,
            recent_activity=recent_activity,
        )

    @staticmethod
    def _to_activity_item(activity: ProjectActivity) -> ActivityItem:
        """Convert ProjectActivity database model to frontend ActivityItem schema."""
        # Format message matching frontend expectations
        actor = activity.user_name or "Team Member"
        message = (
            f"{actor} moved '{activity.task_title}' from {activity.from_status} to {activity.to_status}"
        )
        iso_timestamp = (
            activity.created_at.isoformat()
            if activity.created_at
            else datetime.now(timezone.utc).isoformat()
        )
        return ActivityItem(
            id=str(activity.id),
            type="task_updated",
            message=message,
            timestamp=iso_timestamp,
        )


# Shared singleton instance
dashboard_service = DashboardService()
