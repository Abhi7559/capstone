"""Analytics Service Layer for calculating chart aggregations.

Computes task metrics formatted for Recharts:
1. Status Distribution (Pie Chart): count per task status.
2. Tasks by Assignee (Bar Chart): task count per member.
3. Completion Trend (Line Chart): continuous 7-day chronological completion trajectory.

Supports an optional `project_id` filter and enforces project access permissions.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from dao.task_dao import task_dao
from dao.project_dao import project_dao
from dao.activity_dao import activity_dao
from exceptions.domain import EntityNotFoundException, ForbiddenException
from models.user import User
from schemas.analytics_schema import (
    AnalyticsDataResponse,
    StatusDistributionItem,
    AssigneeDistributionItem,
    CompletionTrendItem,
)


class AnalyticsService:
    """Service handling task analytics and Recharts data aggregations."""

    # Frontend color palette matching utils/analyticsTransformations.ts
    STATUS_CONFIG = [
        {"key": "backlog", "name": "Backlog", "color": "#94a3b8"},
        {"key": "todo", "name": "To Do", "color": "#64748b"},
        {"key": "in_progress", "name": "In Progress", "color": "#3b82f6"},
        {"key": "done", "name": "Done", "color": "#22c55e"},
    ]

    async def get_analytics_data(
        self,
        db: AsyncSession,
        current_user: User,
        project_id: Optional[UUID] = None,
    ) -> AnalyticsDataResponse:
        """
        Compute task analytics for frontend charts:
        - Validates access if project_id is provided.
        - Scopes data to the user's assigned projects if member and project_id is omitted.
        - Assembles status distribution, assignee workloads, and 7-day completion trends.
        """
        role = (current_user.role or "").lower()
        is_admin = role == "admin"

        # 1. Scope / Permission verification
        allowed_project_ids: Optional[List[UUID]] = None

        if project_id is not None:
            project = await project_dao.get_by_id(db, project_id)
            if not project:
                raise EntityNotFoundException(entity_name="Project", identifier=project_id)

            if not is_admin:
                member_ids = {m.id for m in project.members}
                if current_user.id not in member_ids:
                    raise ForbiddenException(
                        detail="You do not have access to view analytics for this project."
                    )
        elif not is_admin:
            # Member caller without specific project: scope to assigned projects
            member_projects = await project_dao.get_all_for_member(
                db, user_id=current_user.id
            )
            allowed_project_ids = [p.id for p in member_projects]

        # 2. Status Distribution (Pie Chart)
        status_distribution = await self._calculate_status_distribution(
            db,
            project_id=project_id,
            allowed_project_ids=allowed_project_ids,
        )

        # 3. Tasks by Assignee (Bar Chart)
        tasks_by_assignee = await self._calculate_tasks_by_assignee(
            db,
            project_id=project_id,
            allowed_project_ids=allowed_project_ids,
        )

        # 4. Completion Trends (Line Chart) over last 7 days
        completion_trends = await self._calculate_completion_trends(
            db,
            project_id=project_id,
            allowed_project_ids=allowed_project_ids,
        )

        return AnalyticsDataResponse(
            status_distribution=status_distribution,
            tasks_by_assignee=tasks_by_assignee,
            completion_trends=completion_trends,
        )

    async def _calculate_status_distribution(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        allowed_project_ids: Optional[List[UUID]] = None,
    ) -> List[StatusDistributionItem]:
        """Aggregate task counts per status, preserving consistent order and fill colors."""
        db_counts = await task_dao.get_status_distribution(
            db,
            project_id=project_id,
            allowed_project_ids=allowed_project_ids,
            include_deleted=False,
        )

        slices = []
        for cfg in self.STATUS_CONFIG:
            key = cfg["key"]
            count = db_counts.get(key, 0)
            slices.append(
                StatusDistributionItem(
                    name=cfg["name"],
                    value=count,
                    color=cfg["color"],
                )
            )
        return slices

    async def _calculate_tasks_by_assignee(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        allowed_project_ids: Optional[List[UUID]] = None,
    ) -> List[AssigneeDistributionItem]:
        """Aggregate workload counts per assignee."""
        workload_rows = await task_dao.get_workload_by_assignee(
            db,
            project_id=project_id,
            allowed_project_ids=allowed_project_ids,
            include_deleted=False,
        )

        items = []
        for row in workload_rows:
            full_name = row["assignee_name"]
            short_name = full_name.split(" ")[0] if full_name else "Unassigned"
            count = row["count"]
            items.append(
                AssigneeDistributionItem(
                    assignee=full_name,
                    name=short_name,
                    count=count,
                    tasks_count=count,
                )
            )
        return items

    async def _calculate_completion_trends(
        self,
        db: AsyncSession,
        *,
        project_id: Optional[UUID] = None,
        allowed_project_ids: Optional[List[UUID]] = None,
    ) -> List[CompletionTrendItem]:
        """
        Calculate task completions over the last 7 calendar days in chronological order.
        Uses project_activities status-transitions to 'done' as authoritative completion logs.
        Fills zero-completion days to ensure a continuous 7-day timeline.
        """
        now = datetime.now(timezone.utc)
        today = now.date()
        start_date = today - timedelta(days=6)  # 7-day window including today: [D-6, ..., D]

        # Query transition events where to_status == 'done'
        start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        end_dt = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)

        activity_records = await activity_dao.get_completions_over_interval(
            db,
            start_datetime=start_dt,
            end_datetime=end_dt,
            project_id=project_id,
            allowed_project_ids=allowed_project_ids,
        )

        # Count completion transitions by calendar date
        daily_counts = { (start_date + timedelta(days=i)): 0 for i in range(7) }

        for act in activity_records:
            if act.created_at:
                act_date = act.created_at.date()
                if act_date in daily_counts:
                    daily_counts[act_date] += 1

        # Also cross-check tasks currently in status == 'done' with updated_at in the window
        # to capture seeded or directly updated tasks if no activity transition log exists
        if not activity_records:
            completed_tasks = await task_dao.get_filtered(
                db,
                project_id=project_id,
                status="done",
                include_deleted=False,
            )
            for t in completed_tasks:
                if t.updated_at:
                    t_date = t.updated_at.date()
                    if t_date in daily_counts:
                        daily_counts[t_date] += 1

        # Build chronological 7-day series
        series = []
        for i in range(7):
            d = start_date + timedelta(days=i)
            iso_date_str = d.isoformat()
            count = daily_counts.get(d, 0)
            series.append(
                CompletionTrendItem(
                    date=iso_date_str,
                    completed=count,
                    completed_count=count,
                )
            )

        return series


# Shared singleton instance
analytics_service = AnalyticsService()
