"""Project Pydantic Schemas for validation and API contracts."""

import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import Field, model_validator, field_validator, ConfigDict

from schemas.base import CamelCaseModel


class KanbanColumnSchema(CamelCaseModel):
    """Schema for a single Kanban column definition stored inside a project.
    
    Tolerates both legacy DB format ({'name', 'slug', 'order'}) and
    new format ({'label', 'status', 'color', 'is_custom'}).
    """

    model_config = ConfigDict(
        alias_generator=CamelCaseModel.model_config["alias_generator"],
        populate_by_name=True,
        from_attributes=True,
        extra="ignore",
    )

    id: str = Field(default="col_default", description="Stable column identifier, e.g. 'col_todo'")
    label: str = Field(default="Column", description="Display label shown in UI")
    status: str = Field(default="todo", description="Task status value this column represents")
    color: str = Field(default="bg-purple-50 border-purple-200 text-purple-800", description="Tailwind colour classes")
    is_custom: bool = Field(default=False, description="True for user-created columns")
    order: Optional[int] = Field(default=None, description="Column display order")

    @model_validator(mode="before")
    @classmethod
    def normalize_column_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map legacy 'name' -> 'label'
            if "name" in data and "label" not in data:
                data["label"] = data["name"]
            # Map legacy 'slug' -> 'status'
            if "slug" in data and "status" not in data:
                data["status"] = data["slug"]
            # Fallback if label/status are empty
            if not data.get("label"):
                data["label"] = str(data.get("name") or data.get("status") or "Column").upper()
            if not data.get("status"):
                data["status"] = str(data.get("slug") or data.get("label") or "todo").lower().replace(" ", "_")
            if not data.get("id"):
                data["id"] = f"col_{data['status']}"
            if not data.get("color"):
                status_norm = str(data["status"]).lower()
                if "todo" in status_norm:
                    data["color"] = "bg-slate-100 border-slate-300 text-slate-700"
                elif "progress" in status_norm:
                    data["color"] = "bg-blue-50 border-blue-200 text-blue-800"
                elif "done" in status_norm or "complete" in status_norm:
                    data["color"] = "bg-green-50 border-green-200 text-green-800"
                else:
                    data["color"] = "bg-purple-50 border-purple-200 text-purple-800"
        return data


class ProjectStatus(str, Enum):
    """Allowed project status values matching the frontend contract and database constraint."""

    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectPriority(str, Enum):
    """Allowed project priority values."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ProjectCategory(str, Enum):
    """Allowed project category values matching frontend options."""

    ENGINEERING = "Engineering"
    PRODUCT_DESIGN = "Product Design"
    MARKETING_AND_BRAND = "Marketing & Brand"
    OPERATIONS = "Operations"
    SECURITY_AND_COMPLIANCE = "Security & Compliance"


class ProjectBase(CamelCaseModel):
    """Base schema for project models with standard parsing and validation."""

    model_config = ConfigDict(
        alias_generator=CamelCaseModel.model_config["alias_generator"],
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
        strict=False,
    )


class ProjectCreate(ProjectBase):
    """Payload submitted when creating a new project (Admin only)."""

    name: str = Field(min_length=3, max_length=50)
    description: str = Field(default="No description provided.", min_length=1)
    status: ProjectStatus = Field(default=ProjectStatus.PLANNING)
    category: Optional[ProjectCategory] = Field(default=ProjectCategory.ENGINEERING)
    priority: Optional[ProjectPriority] = Field(default=ProjectPriority.MEDIUM)
    start_date: Optional[date] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    member_ids: Optional[List[uuid.UUID]] = Field(default=None)

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, v):
        if not v or not str(v).strip():
            return "No description provided."
        return str(v).strip()

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        if v is None:
            return v
        if isinstance(v, ProjectCategory):
            return v
        str_val = str(v).strip().lower()
        for cat in ProjectCategory:
            if cat.value.lower() == str_val:
                return cat
        raise ValueError(
            f"Invalid category '{v}'. Allowed categories: {[c.value for c in ProjectCategory]}"
        )

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if v is None:
            return v
        if isinstance(v, ProjectPriority):
            return v
        str_val = str(v).strip().lower()
        for p in ProjectPriority:
            if p.value.lower() == str_val:
                return p
        raise ValueError(
            f"Invalid priority '{v}'. Allowed priorities: {[p.value for p in ProjectPriority]}"
        )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is None:
            return v
        if isinstance(v, ProjectStatus):
            return v
        str_val = str(v).strip().lower()
        for s in ProjectStatus:
            if s.value.lower() == str_val:
                return s
        raise ValueError(
            f"Invalid status '{v}'. Allowed statuses: {[s.value for s in ProjectStatus]}"
        )

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectCreate":
        """Validate that due_date is greater than or equal to start_date when both are present."""
        if self.start_date and self.due_date:
            if self.due_date < self.start_date:
                raise ValueError("dueDate must be greater than or equal to startDate")
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("endDate must be greater than or equal to startDate")
        return self


class ProjectUpdate(ProjectBase):
    """Payload for partial updates to a project."""

    name: Optional[str] = Field(default=None, min_length=3, max_length=50)
    description: Optional[str] = Field(default=None, min_length=1)
    status: Optional[ProjectStatus] = Field(default=None)
    category: Optional[ProjectCategory] = Field(default=None)
    priority: Optional[ProjectPriority] = Field(default=None)
    start_date: Optional[date] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    previous_status: Optional[ProjectStatus] = Field(default=None)
    member_ids: Optional[List[uuid.UUID]] = Field(default=None)
    kanban_columns: Optional[List[KanbanColumnSchema]] = Field(
        default=None,
        description="Ordered list of Kanban column definitions for this project. Max 8 columns.",
    )

    @field_validator("kanban_columns", mode="before")
    @classmethod
    def validate_kanban_columns(cls, v):
        if v is None:
            return v
        if not isinstance(v, list):
            raise ValueError("kanban_columns must be a list.")
        if len(v) > 8:
            raise ValueError("A project can have at most 8 Kanban columns.")
        return v

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        if v is None:
            return v
        if isinstance(v, ProjectCategory):
            return v
        str_val = str(v).strip().lower()
        for cat in ProjectCategory:
            if cat.value.lower() == str_val:
                return cat
        raise ValueError(
            f"Invalid category '{v}'. Allowed categories: {[c.value for c in ProjectCategory]}"
        )

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if v is None:
            return v
        if isinstance(v, ProjectPriority):
            return v
        str_val = str(v).strip().lower()
        for p in ProjectPriority:
            if p.value.lower() == str_val:
                return p
        raise ValueError(
            f"Invalid priority '{v}'. Allowed priorities: {[p.value for p in ProjectPriority]}"
        )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if v is None:
            return v
        if isinstance(v, ProjectStatus):
            return v
        str_val = str(v).strip().lower()
        for s in ProjectStatus:
            if s.value.lower() == str_val:
                return s
        raise ValueError(
            f"Invalid status '{v}'. Allowed statuses: {[s.value for s in ProjectStatus]}"
        )

    @model_validator(mode="after")
    def validate_dates(self) -> "ProjectUpdate":
        """Validate date ordering when both dates are provided in the partial update."""
        if self.start_date and self.due_date:
            if self.due_date < self.start_date:
                raise ValueError("dueDate must be greater than or equal to startDate")
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("endDate must be greater than or equal to startDate")
        return self


class ProjectMemberSummary(CamelCaseModel):
    """Compact summary of a project member (id, name, email, role) for display in project views."""

    id: uuid.UUID
    name: str
    email: Optional[str] = None
    role: Optional[str] = None


class ProjectOut(ProjectBase):
    """Public project representation returned by API endpoints matching the frontend Project contract."""

    id: uuid.UUID
    name: str
    description: str
    status: ProjectStatus
    category: Optional[str] = None
    priority: Optional[ProjectPriority] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    end_date: Optional[date] = None
    previous_status: Optional[ProjectStatus] = None
    is_deleted: bool = False
    progress: int = Field(default=0, ge=0, le=100)
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    member_ids: List[uuid.UUID] = Field(default_factory=list)
    members: List[ProjectMemberSummary] = Field(default_factory=list)
    kanban_columns: List[KanbanColumnSchema] = Field(
        default_factory=list,
        description="Ordered Kanban column definitions. Empty list means use frontend defaults.",
    )


# Backward-compatible alias for existing imports if needed
ProjectRead = ProjectOut


class ProjectActivityRead(CamelCaseModel):
    """Schema for project activity audit log representation."""

    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    user_id: Optional[uuid.UUID] = None
    user_name: str
    from_status: str
    to_status: str
    created_at: datetime


class ProjectDeleteResponse(CamelCaseModel):
    """Positive response when deleting a project according to QAex.md."""

    success: bool = True
    message: str = "Project deleted successfully."


class PaginationMeta(CamelCaseModel):
    """Pagination metadata matching QA.md Section 5.3 API 6."""

    total_items: int
    page: int
    page_size: int
    totalPages: int
    has_next_page: bool
    has_prev_page: bool


class PaginatedProjectsResponse(CamelCaseModel):
    """Envelope response returned by GET /projects when pagination is requested."""

    items: List[ProjectOut]
    pagination: PaginationMeta
