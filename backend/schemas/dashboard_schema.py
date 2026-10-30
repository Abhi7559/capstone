"""Dashboard Pydantic schemas for Admin and Member dashboard data.

Matches:
- frontend TypeScript interfaces (types/dashboard.ts)
- frontend Dashboard page consumption (pages/dashboard.tsx)
- QA.md Dashboard Schemas (Section 5.6 API 21)
"""

from typing import List
from schemas.base import CamelCaseModel
from schemas.project_schema import ProjectOut
from schemas.task_schema import TaskOut


class ActivityItem(CamelCaseModel):
    """Activity feed item matching types/dashboard.ts ActivityItem interface."""

    id: str
    type: str  # "task_created" | "task_updated" | "project_created" | "member_invited"
    message: str
    timestamp: str


class AdminDashboardData(CamelCaseModel):
    """Admin dashboard metrics and overview data."""

    total_projects: int
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    recently_created_tasks: List[TaskOut]
    recent_activity: List[ActivityItem]


class MemberDashboardData(CamelCaseModel):
    """Member dashboard metrics and personal assignments."""

    my_assigned_tasks: List[TaskOut]
    my_overdue_tasks: List[TaskOut]
    tasks_due_soon: List[TaskOut]
    my_projects: List[ProjectOut]
    recent_activity: List[ActivityItem]
