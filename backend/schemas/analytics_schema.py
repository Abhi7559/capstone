"""Analytics Pydantic Schemas for validation and API contracts.

Matches QA.md Section 5.6 API 22 and schemas/base.py CamelCaseModel.
Also provides compatibility with frontend chart interfaces.
"""

from datetime import date
from typing import List, Optional
from schemas.base import CamelCaseModel


class StatusDistributionItem(CamelCaseModel):
    """Task count by status slice for Recharts Pie Chart."""

    name: str  # e.g. "Backlog", "To Do", "In Progress", "Done"
    value: int  # count of tasks
    color: Optional[str] = None  # Hex color for frontend Recharts fill


class AssigneeDistributionItem(CamelCaseModel):
    """Task count per assignee for Recharts Bar Chart."""

    assignee: str  # Assignee display name
    name: Optional[str] = None  # Compatible alias for frontend recharts dataKey="name"
    count: int  # Task count
    tasks_count: Optional[int] = None  # Compatible alias for frontend dataKey="tasksCount"


class CompletionTrendItem(CamelCaseModel):
    """Completion trend per day over the 7-day window for Recharts Line Chart."""

    date: str  # Formatted date string (e.g. "2026-10-22" or "Oct 22")
    completed: int  # Completed task count
    completed_count: Optional[int] = None  # Compatible alias for frontend dataKey="completedCount"


class AnalyticsDataResponse(CamelCaseModel):
    """Analytics response payload matching QA.md API 22."""

    status_distribution: List[StatusDistributionItem]
    tasks_by_assignee: List[AssigneeDistributionItem]
    completion_trends: List[CompletionTrendItem]
