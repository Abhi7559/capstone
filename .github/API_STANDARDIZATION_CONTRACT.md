# API_STANDARDIZATION_CONTRACT.md

# Team Hub Capstone — Shared Team API Contract & Standardization Guide

> **Context & Requirement:**  
> *"While creating the docs and while implementing, all four of you use the same API naming.  
> If Abhishek uses a specific pattern, everybody use the same naming and same pattern.  
> And also with Request Body, let all of your request bodies be similar."*

---

## 1. What This Instruction Means in Simple Terms

Your mentor / manager is emphasizing **API Contract Standardization** across your entire team.

When multiple developers work on different modules (e.g., Developer 1 on Auth, Developer 2 on Projects, Developer 3 on Tasks, Developer 4 on Members/Dashboard), a very common mistake is that each developer invents their own naming style:

### ❌ The Problem (Inconsistent Team Naming):
- Developer A writes: `POST /capstone/api/v1/task/create` (uses `/create` verb, singular `task`)
- Developer B writes: `POST /api/v1/projects` (uses pure REST, plural `projects`)
- Developer C writes: `POST /api/v1/add-member` (uses kebab-case with action verb)
- Developer A uses **snake_case** in request body: `{"project_id": "...", "due_date": "..."}`
- Developer B uses **camelCase** in request body: `{"projectId": "...", "dueDate": "..."}`

If this happens:
1. **The frontend breaks** because it expects one consistent URL pattern and field casing.
2. The team's codebase looks messy, unstructured, and uncoordinated.

### ✅ What Your Mentor Wants (100% Shared Standard):
All 4 developers must follow **the exact same URL naming convention, HTTP verbs, and Request Body field casing** across all documentation and backend code!

---

## 2. The Chosen Standard for Our Team

To ensure complete compatibility with our existing Next.js frontend (which uses standard RESTful routes with camelCase JSON fields):

### 2.1 URL Routing Pattern Standard: Standard RESTful Plural Resources
- **Base Prefix:** `/api/v1` (or whichever prefix your group agrees upon, e.g., `/capstone/api/v1`)
- **Resource Names:** Always **plural nouns** (`/projects`, `/tasks`, `/members`, `/auth`)
- **No verbs in URLs:** We use HTTP methods (`POST`, `GET`, `PATCH`, `DELETE`) instead of writing `/create`, `/delete`, `/update` in the URL!

| Operation | Standard Endpoint | HTTP Verb | NOT THIS (Anti-pattern) |
|---|---|:---:|---|
| **Create Task** | `/api/v1/tasks` | `POST` | `POST /api/v1/tasks/create` ❌ |
| **Get Tasks** | `/api/v1/tasks` | `GET` | `GET /api/v1/get-all-tasks` ❌ |
| **Update Task** | `/api/v1/tasks/{id}` | `PATCH` | `POST /api/v1/tasks/update/{id}` ❌ |
| **Delete Task** | `/api/v1/tasks/{id}` | `DELETE` | `GET /api/v1/tasks/delete?id=...` ❌ |
| **Create Project** | `/api/v1/projects` | `POST` | `POST /api/v1/project/new` ❌ |
| **List Projects** | `/api/v1/projects` | `GET` | `GET /api/v1/project-list` ❌ |
| **Invite Member** | `/api/v1/members/invite` | `POST` | `POST /api/v1/add-team-member` ❌ |
| **Dashboard Stats** | `/api/v1/dashboard/stats` | `GET` | `GET /api/v1/getDashboardData` ❌ |

---

## 3. Request Body Standardization: Field Casing & Structure

The frontend expects **`camelCase`** in JSON request payloads and responses (matching TypeScript interfaces).

In FastAPI (Python), Python variables use `snake_case`, but Pydantic v2 has a built-in feature to automatically accept and return **`camelCase`** using `populate_by_name = True` or `alias_generator`!

### 3.1 Standard Request Bodies Across All 4 Developers

#### Developer 1: Authentication (`/api/v1/auth`)
```json
// POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "Password123!"
}

// POST /api/v1/auth/change-password
{
  "email": "user@example.com",
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

#### Developer 2: Projects (`/api/v1/projects`)
```json
// POST /api/v1/projects
{
  "name": "Team Hub Migration",
  "description": "Migrating to FastAPI and PostgreSQL",
  "status": "planning",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-01",
  "memberIds": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

#### Developer 3: Tasks (`/api/v1/tasks`)
```json
// POST /api/v1/tasks
{
  "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
  "title": "Configure Redis connection pool",
  "description": "Set up shared Redis connection pool and health checks",
  "priority": "high",
  "status": "todo",
  "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
  "dueDate": "2026-11-15",
  "tags": ["backend", "redis"]
}
```

#### Developer 4: Team Members (`/api/v1/members`)
```json
// POST /api/v1/members/invite
{
  "name": "Sarah Connor",
  "email": "sarah@company.com",
  "designation": "QA Engineer",
  "joiningDate": "2026-11-01"
}
```

---

## 4. How to Implement This in Pydantic v2 (Python)

To ensure all developers' code seamlessly accepts `camelCase` from the frontend while keeping clean `snake_case` in Python:

```python
# backend/schemas/base.py
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelCaseModel(BaseModel):
    """
    Shared Base Schema: Automatically converts snake_case Python fields 
    to/from camelCase JSON keys expected by the frontend!
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True
    )
```

Now, every developer inherits from `CamelCaseModel`:
```python
class TaskCreate(CamelCaseModel):
    project_id: uuid.UUID    # Automatically accepts & returns "projectId"!
    title: str
    description: str
    priority: str = "medium"
    status: str = "todo"
    assignee_id: Optional[uuid.UUID] = None  # Accepts "assigneeId"!
    due_date: date           # Accepts "dueDate"!
    tags: list[str] = []
```

---

## 5. Master Contract Summary for Your Team

Share this table with all 4 team members so everyone uses the **exact same endpoint names**:

| Domain | Method | Unified Endpoint | Request Body Schema |
|---|:---:|---|---|
| **Auth** | `POST` | `/api/v1/auth/login` | `{ "email", "password" }` |
| **Auth** | `POST` | `/api/v1/auth/change-password` | `{ "email", "currentPassword", "newPassword", "confirmPassword" }` |
| **Auth** | `POST` | `/api/v1/auth/refresh` | `{ "refreshToken" }` |
| **Projects** | `GET` | `/api/v1/projects` | Query params: `status`, `category` |
| **Projects** | `POST` | `/api/v1/projects` | `{ "name", "description", "status", "category", "priority", "startDate", "dueDate", "memberIds" }` |
| **Projects** | `PATCH` | `/api/v1/projects/{id}` | Partial project fields |
| **Projects** | `DELETE`| `/api/v1/projects/{id}` | None |
| **Projects** | `GET` | `/api/v1/projects/{id}/activities` | None |
| **Tasks** | `GET` | `/api/v1/tasks` | Query params: `projectId`, `status`, `priority`, `assigneeId`, `dueDate` |
| **Tasks** | `POST` | `/api/v1/tasks` | `{ "projectId", "title", "description", "priority", "status", "assigneeId", "dueDate", "tags" }` |
| **Tasks** | `PATCH` | `/api/v1/tasks/{id}` | Partial task fields (e.g. `{ "status" }`) |
| **Tasks** | `DELETE`| `/api/v1/tasks/{id}` | None |
| **Members** | `GET` | `/api/v1/members` | None |
| **Members** | `POST` | `/api/v1/members/invite` | `{ "name", "email", "designation", "joiningDate" }` |
| **Members** | `PATCH` | `/api/v1/members/{id}` | `{ "name", "designation", "role" }` |
| **Members** | `DELETE`| `/api/v1/members/{id}` | None |
| **Dashboard**| `GET` | `/api/v1/dashboard/stats` | None |
| **Analytics**| `GET` | `/api/v1/analytics/overview` | Query param: `projectId` |

By adhering to this shared contract, your backend will integrate seamlessly with the frontend and satisfy your mentor's evaluation criteria!
