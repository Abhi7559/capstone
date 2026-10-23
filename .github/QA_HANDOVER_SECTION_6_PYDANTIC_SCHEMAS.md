## 6. Pydantic Schemas

Pydantic schemas enforce incoming request body validation and outgoing JSON response serialization.

To bridge our **Next.js frontend** (which sends and expects `camelCase` keys like `projectId`, `dueDate`, `requiresPasswordChange`) with our **FastAPI backend** (which writes clean, idiomatic Python `snake_case` attributes like `project_id`, `due_date`, `requires_password_change`), all schemas inherit from **`CamelCaseModel`**.

---

### 6.1 Base Schema (`schemas/base.py`)

Configures automatic bi-directional alias mapping using Pydantic v2's `alias_generator = to_camel`:

```python
# app/schemas/base.py
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelCaseModel(BaseModel):
    """
    Base Pydantic model enforcing automatic camelCase serialization for the Next.js frontend
    while allowing native snake_case attributes in backend Python code.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True
    )
```

---

### 6.2 Authentication & User Schemas (`schemas/auth.py`)

Matches [`types/auth.ts`](file:///c:/Users/abhishek/capstone-project/types/auth.ts) and powers `/task_management/api/v1/auth/*`:

```python
# app/schemas/auth.py
import uuid
from datetime import date, datetime
from typing import Optional, Literal
from pydantic import EmailStr, Field
from app.schemas.base import CamelCaseModel

UserRole = Literal["admin", "member"]
MemberStatus = Literal["active", "invited", "suspended"]

class UserBase(CamelCaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=150)
    role: UserRole = "member"
    designation: Optional[str] = "Contributor"

class LoginRequest(CamelCaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class UserRead(UserBase):
    id: uuid.UUID
    status: MemberStatus = "active"
    requires_password_change: bool = False
    joining_date: date
    created_at: Optional[datetime] = None

class LoginResponse(CamelCaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserRead

class TokenRefreshRequest(CamelCaseModel):
    refresh_token: str

class TokenRefreshResponse(CamelCaseModel):
    access_token: str
    token_type: str = "Bearer"

class ChangePasswordRequest(CamelCaseModel):
    email: EmailStr
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)
```

---

### 6.3 Project Schemas (`schemas/project.py`)

Matches [`types/project.ts`](file:///c:/Users/abhishek/capstone-project/types/project.ts) and powers `/task_management/api/v1/projects/*`:

```python
# app/schemas/project.py
import uuid
from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import Field, model_validator
from app.schemas.base import CamelCaseModel

ProjectStatus = Literal["planning", "active", "on_hold", "completed", "archived"]
ProjectPriority = Literal["low", "medium", "high", "critical"]

class ProjectBase(CamelCaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    status: ProjectStatus = "planning"
    category: Optional[str] = "General"
    priority: Optional[ProjectPriority] = "medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    end_date: Optional[date] = None

class ProjectCreate(ProjectBase):
    member_ids: List[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("dueDate cannot precede startDate")
        return self

class ProjectUpdate(CamelCaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    category: Optional[str] = None
    priority: Optional[ProjectPriority] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    end_date: Optional[date] = None
    member_ids: Optional[List[uuid.UUID]] = None
    previous_status: Optional[ProjectStatus] = None

class ProjectResponse(ProjectBase):
    id: uuid.UUID
    progress: int = Field(default=0, ge=0, le=100)
    member_ids: List[uuid.UUID] = Field(default_factory=list)
    previous_status: Optional[ProjectStatus] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProjectActivityResponse(CamelCaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    user_id: Optional[uuid.UUID] = None
    user_name: str
    from_status: str
    to_status: str
    created_at: datetime
```

---

### 6.4 Task Schemas (`schemas/task.py`)

Matches [`types/task.ts`](file:///c:/Users/abhishek/capstone-project/types/task.ts) and powers `/task_management/api/v1/tasks/*`:

```python
# app/schemas/task.py
import uuid
from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import Field
from app.schemas.base import CamelCaseModel

TaskStatus = Literal["backlog", "todo", "in_progress", "done"]
TaskPriority = Literal["low", "medium", "high", "critical"]

class TaskBase(CamelCaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(default="")
    priority: TaskPriority = "medium"
    status: TaskStatus = "todo"
    assignee_id: Optional[uuid.UUID] = None
    due_date: date
    tags: List[str] = Field(default_factory=list)

class TaskCreate(TaskBase):
    project_id: uuid.UUID

class TaskUpdate(CamelCaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    tags: Optional[List[str]] = None

class TaskResponse(TaskBase):
    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

class TaskFilterParams(CamelCaseModel):
    project_id: Optional[uuid.UUID] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
```

---

### 6.5 Member Schemas (`schemas/member.py`)

Powers member invitations and workspace roster management:

```python
# app/schemas/member.py
import uuid
from datetime import date
from typing import Optional
from pydantic import EmailStr, Field
from app.schemas.base import CamelCaseModel
from app.schemas.auth import UserRead, UserRole

class MemberInviteRequest(CamelCaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    designation: Optional[str] = "Contributor"
    joining_date: Optional[date] = None

class MemberInviteResponse(CamelCaseModel):
    message: str
    member: UserRead

class MemberUpdateRequest(CamelCaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    designation: Optional[str] = None
    role: Optional[UserRole] = None  # Only Admin can update role
```

---

### 6.6 Dashboard & Analytics Schemas (`schemas/dashboard.py` & `schemas/analytics.py`)

Matches [`types/dashboard.ts`](file:///c:/Users/abhishek/capstone-project/types/dashboard.ts) and frontend Recharts contracts:

```python
# app/schemas/dashboard.py
from typing import List
from app.schemas.base import CamelCaseModel
from app.schemas.project import ProjectResponse
from app.schemas.task import TaskResponse

class AdminDashboardData(CamelCaseModel):
    total_projects: int
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    recently_created_tasks: List[TaskResponse]

class MemberDashboardData(CamelCaseModel):
    my_assigned_tasks: List[TaskResponse]
    my_overdue_tasks: List[TaskResponse]
    tasks_due_soon: List[TaskResponse]
    my_projects: List[ProjectResponse]

# app/schemas/analytics.py
from app.schemas.base import CamelCaseModel

class StatusDistributionItem(CamelCaseModel):
    name: str
    value: int

class AssigneeDistributionItem(CamelCaseModel):
    assignee: str
    count: int

class CompletionTrendItem(CamelCaseModel):
    date: str
    completed: int

class AnalyticsDataResponse(CamelCaseModel):
    status_distribution: List[StatusDistributionItem]
    tasks_by_assignee: List[AssigneeDistributionItem]
    completion_trends: List[CompletionTrendItem]
```
