"""Task and Project Activity Pydantic Schemas for validation and API contracts.

Matches the frontend TypeScript contracts (types/task.ts, types/project.ts, schemas/task.schema.ts)
and QA.md Section 5.4 Task APIs (APIs 11-16).
"""

import uuid
from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from pydantic import ConfigDict, Field, field_validator

from schemas.base import CamelCaseModel
from schemas.project_schema import PaginationMeta


class TaskStatus(str, Enum):
    """Allowed task lifecycle statuses matching the Kanban board."""

    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, Enum):
    """Allowed task priority levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskBase(CamelCaseModel):
    """Base schema for tasks with standard camelCase serialization and resilient configuration."""

    model_config = ConfigDict(
        alias_generator=CamelCaseModel.model_config["alias_generator"],
        populate_by_name=True,
        from_attributes=True,
        extra="ignore",
        strict=False,
    )


class TaskCreate(TaskBase):
    """Payload submitted when creating a new task (API 13)."""

    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    status: str = Field(default="todo")
    assignee_id: Optional[uuid.UUID] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    tags: List[str] = Field(default_factory=list)

    @field_validator("assignee_id", mode="before")
    @classmethod
    def normalize_assignee_id(cls, v):
        if not v or str(v).strip() in ("", "null", "undefined", "none", "None"):
            return None
        return v

    @field_validator("due_date", mode="before")
    @classmethod
    def normalize_due_date(cls, v):
        if not v or str(v).strip() in ("", "null", "undefined", "none", "None"):
            return None
        return v

    @field_validator("title", mode="before")
    @classmethod
    def validate_title_not_blank(cls, v: str) -> str:
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Title must not be blank")
            return trimmed
        return v

    @field_validator("description", mode="before")
    @classmethod
    def validate_description_not_blank(cls, v: str) -> str:
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Description must not be blank")
            return trimmed
        return v

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if v is None:
            return v
        if isinstance(v, TaskPriority):
            return v
        str_val = str(v).strip().lower()
        for p in TaskPriority:
            if p.value == str_val:
                return p
        raise ValueError(
            f"Invalid priority '{v}'. Allowed priorities: {[p.value for p in TaskPriority]}"
        )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is None:
            return v
        if isinstance(v, TaskStatus):
            return v.value
        str_val = str(v).strip().lower()
        return str_val


class TaskUpdate(TaskBase):
    """Payload for partial task updates (API 15).

    Every field is optional so clients can update individual properties (such as moving
    cards across Kanban columns) using model_dump(exclude_unset=True).
    """

    project_id: Optional[uuid.UUID] = Field(default=None)
    title: Optional[str] = Field(default=None, min_length=1, max_length=50)
    description: Optional[str] = Field(default=None, min_length=1)
    priority: Optional[TaskPriority] = Field(default=None)
    status: Optional[str] = Field(default=None)
    assignee_id: Optional[uuid.UUID] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator("assignee_id", mode="before")
    @classmethod
    def normalize_assignee_id(cls, v):
        if not v or str(v).strip() in ("", "null", "undefined", "none", "None"):
            return None
        return v

    @field_validator("due_date", mode="before")
    @classmethod
    def normalize_due_date(cls, v):
        if not v or str(v).strip() in ("", "null", "undefined", "none", "None"):
            return None
        return v

    @field_validator("title", mode="before")
    @classmethod
    def validate_title_not_blank(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Title must not be blank")
            return trimmed
        return v

    @field_validator("description", mode="before")
    @classmethod
    def validate_description_not_blank(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("Description must not be blank")
            return trimmed
        return v

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if v is None:
            return v
        if isinstance(v, TaskPriority):
            return v
        str_val = str(v).strip().lower()
        for p in TaskPriority:
            if p.value == str_val:
                return p
        raise ValueError(
            f"Invalid priority '{v}'. Allowed priorities: {[p.value for p in TaskPriority]}"
        )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is None:
            return v
        if isinstance(v, TaskStatus):
            return v.value
        str_val = str(v).strip().lower()
        return str_val


class TaskOut(TaskBase):
    """Task response object matching frontend Task interface and QA.md API 12/13/14."""

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str
    priority: TaskPriority
    status: str
    assignee_id: Optional[uuid.UUID] = None
    due_date: date
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# Alias for backward compatibility if referenced as TaskRead
TaskRead = TaskOut


class ProjectActivityOut(CamelCaseModel):
    """Project activity response representation matching frontend ProjectActivity interface and QA.md API 11."""

    model_config = ConfigDict(
        alias_generator=CamelCaseModel.model_config["alias_generator"],
        populate_by_name=True,
        from_attributes=True,
        extra="ignore",
        strict=False,
    )

    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    user_id: Optional[uuid.UUID] = None
    user_name: str
    from_status: str
    to_status: str
    created_at: datetime


class PaginatedTasksResponse(CamelCaseModel):
    """Standard paginated task list envelope matching QA.md API 12."""

    items: List[TaskOut]
    pagination: PaginationMeta


class TaskDeleteResponse(CamelCaseModel):
    """Response returned upon deleting a task."""

    success: bool = True
    message: str = "Task deleted successfully."
