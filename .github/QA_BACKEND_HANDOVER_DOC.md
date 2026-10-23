# Engineering & QA Handover Document: Team Hub Capstone

**Project Name:** Team Hub Capstone (Task & Project Management System)  
**Document Version:** `v1.0.0`  
**Target Audience:** QA Engineering, Backend Engineering, Technical Leads  
**Standard Compliance:** RESTful Plural Standard, Pydantic v2 CamelCase Contract, RFC 7807 (Problem Details)

---

## 1. Project Overview

### 1.1 Summary
Team Hub is a collaborative project and task management application. The platform provides:
- **Authentication & RBAC:** Multi-role access control (`admin`, `manager`, `member`, `guest`).
- **Project Tracking:** Project lifecycle tracking, progress calculation, and categorized grouping.
- **Task Management:** Real-time task board with priorities, deadlines, assignees, and tags.
- **Team Collaboration:** Member invitation and activity logging.
- **Analytics & Health:** Dashboard KPI statistics and system health checks.

### 1.2 Architecture Stack
- **Frontend:** Next.js (TypeScript, React 19) sending `camelCase` JSON payloads.
- **Backend Service:** Python FastAPI (ASGI with Uvicorn).
- **Data Validation & Parsing:** Pydantic v2 with automatic `camelCase` ↔ `snake_case` translation.
- **Primary Database:** PostgreSQL 16 (Relational persistence, foreign keys, and indexes).
- **Caching & Ephemeral Store:** Redis 7 (Auth session storage, API rate-limiting, and metric caching).
- **Templating:** Jinja2 (used for server-rendered HTML views e.g., browser-based login and email templates).
- **Automated Testing:** Pytest, pytest-cov, pytest-asyncio, HTTPX (`AsyncClient`).

---

## 2. PostgreSQL Schema & Data Model

### 2.1 Table Structure & Relationships

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : creates
    PROJECTS ||--o{ TASKS : contains
    PROJECTS ||--o{ PROJECT_ACTIVITIES : logs
    USERS ||--o{ TASKS : assigned_to
    USERS ||--o{ PROJECT_MEMBERS : belongs_to
    PROJECTS ||--o{ PROJECT_MEMBERS : associates

    USERS {
        UUID id PK
        VARCHAR email UK
        VARCHAR hashed_password
        VARCHAR name
        VARCHAR role
        VARCHAR designation
        DATE joining_date
        TIMESTAMP created_at
    }

    PROJECTS {
        UUID id PK
        VARCHAR name
        TEXT description
        VARCHAR status
        VARCHAR category
        VARCHAR priority
        DATE start_date
        DATE due_date
        INTEGER progress
        TIMESTAMP created_at
    }

    PROJECT_MEMBERS {
        UUID project_id PK,FK
        UUID user_id PK,FK
        VARCHAR role_in_project
        TIMESTAMP assigned_at
    }

    TASKS {
        UUID id PK
        UUID project_id FK
        UUID assignee_id FK
        VARCHAR title
        TEXT description
        VARCHAR status
        VARCHAR priority
        DATE due_date
        JSONB tags
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PROJECT_ACTIVITIES {
        UUID id PK
        UUID project_id FK
        VARCHAR user_name
        VARCHAR action
        TIMESTAMP timestamp
    }
```

### 2.2 PostgreSQL DDL (Schema Definition)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'guest')),
    designation VARCHAR(150) DEFAULT 'Contributor',
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'on-hold', 'archived')),
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    priority VARCHAR(30) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Project Members (Many-to-Many Join Table)
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_project VARCHAR(50) DEFAULT 'contributor',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (project_id, user_id)
);

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'review', 'done')),
    priority VARCHAR(30) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    due_date DATE,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 5. Project Activities
CREATE TABLE IF NOT EXISTS project_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_name VARCHAR(150) NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for Query Optimization
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
```

---

## 3. External Services Architecture

### 3.1 PostgreSQL
- **Connection URL:** `postgresql+asyncpg://postgres:password@postgres:5432/teamhub`
- **Pool Settings:** `pool_size=20`, `max_overflow=10`, `pool_recycle=1800`
- **Primary Function:** ACID compliance, relational integrity, audit tracking.

### 3.2 Redis 7
- **Connection URL:** `redis://redis:6379/0`
- **Keys & Cache Plan:**

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `auth:token:{userId}` | String (Hash) | 7 days (604800s) | Invalidate sessions upon logout or password reset |
| `ratelimit:login:{ip}` | Integer | 60 seconds | Brute-force protection (max 5 failed attempts per min) |
| `cache:dashboard:stats` | String (JSON) | 180 seconds | Speeds up high-frequency dashboard analytics requests |

---

## 4. Pydantic v2 Data Schemas

Frontend sends `camelCase` JSON; Python models use standard `snake_case`. Inheritance from `CamelCaseModel` performs automatic serialization/deserialization.

```python
# backend/schemas/base.py
import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

class CamelCaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True
    )

# --- AUTH SCHEMAS ---
class LoginRequest(CamelCaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class UserRead(CamelCaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    role: str
    designation: Optional[str] = None
    joining_date: Optional[date] = None

class LoginResponse(CamelCaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserRead

# --- TASK SCHEMAS ---
class TaskCreate(CamelCaseModel):
    project_id: uuid.UUID
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = ""
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    status: str = Field(default="todo", pattern="^(todo|in-progress|review|done)$")
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    tags: List[str] = Field(default_factory=list)

class TaskResponse(CamelCaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str]
    priority: str
    status: str
    assignee_id: Optional[uuid.UUID]
    due_date: Optional[date]
    tags: List[str]
    created_at: datetime
    updated_at: datetime
```

---

## 5. API Flow, Request/Response & Jinja2 Template Route

### 5.1 Route: `POST /task_management/api/v1/login` (REST API)
- **Description:** Authenticates user and issues JWT session token.

#### Flow:
1. Client sends JSON payload with `email` and `password`.
2. Backend checks rate limit in Redis (`ratelimit:login:{ip}`).
3. Queries PostgreSQL for user by `email`.
4. Validates bcrypt password hash.
5. Saves active session in Redis; returns JWT token + user details.

#### Test Cases:

**Case 1: Positive (200 OK)**
- **Request Body:**
```json
{
  "email": "sarah.connor@company.com",
  "password": "ValidPassword123!"
}
```
- **Response Body (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123signature",
  "tokenType": "Bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "sarah.connor@company.com",
    "name": "Sarah Connor",
    "role": "admin",
    "designation": "Lead QA Engineer",
    "joiningDate": "2026-01-15"
  }
}
```

**Case 2: Negative - Wrong Password (`401 Unauthorized`)**
- **Response Body (`401 Unauthorized`):**
```json
{
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid email or password."
}
```

**Case 3: Negative - Bad Validation (`422 Unprocessable Content`)**
- **Request Body:**
```json
{
  "email": "invalid-email-format",
  "password": "123"
}
```
- **Response Body (`422 Unprocessable Content`):**
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error"
    },
    {
      "loc": ["body", "password"],
      "msg": "String should have at least 6 characters",
      "type": "string_too_short"
    }
  ]
}
```

---

### 5.2 Route: `GET /task_management/api/v1/login` (Jinja2 HTML Template Route)
- **Description:** Server-side rendered Jinja2 HTML page for browser-based login and admin fallback.

#### Fastapi Implementation:
```python
# backend/routers/auth.py
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(prefix="/task_management/api/v1", tags=["Authentication"])
templates = Jinja2Templates(directory="templates")

@router.get("/login", response_class=HTMLResponse)
async def get_login_page(request: Request, error: str = None):
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "title": "Team Hub Login",
            "app_name": "Team Hub Capstone",
            "error": error
        }
    )
```

#### Jinja2 Template (`templates/login.html`):
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ title }}</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .box { background: #1e293b; padding: 2rem; border-radius: 8px; width: 340px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
        .box h2 { margin-top: 0; color: #38bdf8; }
        .input-group { margin-bottom: 1rem; }
        label { display: block; font-size: 0.85rem; margin-bottom: 0.3rem; color: #94a3b8; }
        input { width: 100%; padding: 0.6rem; border-radius: 4px; border: 1px solid #334155; background: #0f172a; color: #fff; box-sizing: border-box; }
        button { width: 100%; padding: 0.7rem; background: #0284c7; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .err { background: #7f1d1d; color: #fca5a5; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.85rem; }
    </style>
</head>
<body>
    <div class="box">
        <h2>{{ app_name }}</h2>
        {% if error %}<div class="err">{{ error }}</div>{% endif %}
        <form method="POST" action="/task_management/api/v1/login">
            <div class="input-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required />
            </div>
            <div class="input-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required />
            </div>
            <button type="submit">Sign In</button>
        </form>
    </div>
</body>
</html>
```

---

### 5.3 Route: `POST /api/v1/tasks` (Task Creation)
- **Positive Scenario (`201 Created`):**
  - **Request:**
    ```json
    {
      "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
      "title": "Implement Redis Cache",
      "priority": "high",
      "status": "todo",
      "dueDate": "2026-11-20",
      "tags": ["backend", "redis"]
    }
    ```
  - **Response (`201 Created`):**
    ```json
    {
      "id": "e2a44130-9b43-4ce4-893a-86c07a38755b",
      "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
      "title": "Implement Redis Cache",
      "priority": "high",
      "status": "todo",
      "dueDate": "2026-11-20",
      "tags": ["backend", "redis"],
      "createdAt": "2026-10-22T13:30:00Z",
      "updatedAt": "2026-10-22T13:30:00Z"
    }
    ```
- **Negative Scenario (`404 Not Found`):**
  - Returned when `projectId` does not exist in PostgreSQL.

---

## 6. Testing, Automation & Coverage Strategy

### 6.1 Testing Pyramid
- **Unit Tests (`pytest`):** Pydantic validation, password hashing, token generation, query construction.
- **Integration Tests (`pytest` + `httpx.AsyncClient`):** Database transactional integrity, foreign key cascading, Redis key lifecycle, and HTTP status codes.
- **Contract / E2E Tests:** Verification of `camelCase` schemas between frontend client and backend.

### 6.2 Sample Automated Test Suite
```python
# tests/test_auth.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_api_login_success(async_client: AsyncClient, test_user):
    payload = {"email": test_user["email"], "password": "ValidPassword123!"}
    res = await async_client.post("/task_management/api/v1/login", json=payload)
    assert res.status_code == 200
    assert "accessToken" in res.json()
    assert res.json()["tokenType"] == "Bearer"

@pytest.mark.asyncio
async def test_api_login_invalid_password(async_client: AsyncClient, test_user):
    payload = {"email": test_user["email"], "password": "WrongPassword!"}
    res = await async_client.post("/task_management/api/v1/login", json=payload)
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_jinja2_template_renders(async_client: AsyncClient):
    res = await async_client.get("/task_management/api/v1/login")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Team Hub Login" in res.text
```

### 6.3 Test Run & Coverage Goal
- **Minimum Code Coverage:** 85% branch coverage.
- **CI/CD Command:**
```bash
pytest --cov=backend --cov-report=term-missing --cov-report=html --cov-fail-under=85 tests/
```

---

## 7. QA Verification Checklist
- [ ] Base URLs strictly follow REST standards (no verbs like `/create` or `/delete` in URL).
- [ ] All JSON request bodies and responses use `camelCase`.
- [ ] Database foreign key constraints prevent orphan tasks and member references.
- [ ] Endpoint `POST /task_management/api/v1/login` properly returns `200`, `401`, and `422`.
- [ ] Browser access to `GET /task_management/api/v1/login` renders the Jinja2 HTML page.
- [ ] CI/CD test suite passes with `>= 85%` coverage.
