# Workstream Backend Technical Specification (FastAPI)

> **Document Status:** `APPROVED / READY FOR HANDOVER`  
> **Target Audience:** Backend Engineers, QA Engineers, Technical Product Managers  
> **Repository:** Team Hub Capstone  
> **Architecture Standard:** Clean Architecture / Layered Service Pattern  
> **API Spec Version:** `v1.2.0`  
> **Primary Base URL:** `/api/v1`  
> **Auth & Operational Base URL:** `/task_management/api/v1`

---

## Table of Contents
1. [1. Executive Summary & Architecture Overview](#1-executive-summary--architecture-overview)
2. [2. System Architecture & Component Interaction](#2-system-architecture--component-interaction)
3. [3. Database Architecture (PostgreSQL 16)](#3-database-architecture-postgresql-16)
   - 3.1 Entity Relationship Diagram (ERD)
   - 3.2 Tables, Data Types & Indexes
   - 3.3 Production DDL Script
4. [4. External Services & Infrastructure](#4-external-services--infrastructure)
   - 4.1 PostgreSQL Connection Pool & Transactions
   - 4.2 Redis 7 Cache & Session Store
   - 4.3 Async SMTP Email Service (`aiosmtplib`)
5. [5. Data Validation & Pydantic v2 Contract](#5-data-validation--pydantic-v2-contract)
   - 5.1 CamelCase Translation Foundation
   - 5.2 Auth Schemas
   - 5.3 Task Schemas
   - 5.4 Project Schemas
   - 5.5 Member Schemas
6. [6. Comprehensive API Endpoint Specifications](#6-comprehensive-api-endpoint-specifications)
   - 6.1 `POST /task_management/api/v1/login` (Authentication Flow & Scenarios)
   - 6.2 `GET /task_management/api/v1/login` (Jinja2 Template Server-Side Route)
   - 6.3 `POST /api/v1/tasks` (Task Creation & Scenarios)
   - 6.4 `GET /api/v1/projects` & `POST /api/v1/projects` (Project Lifecycle)
   - 6.5 `POST /api/v1/members/invite` (Zero-Knowledge SMTP Member Invitation)
   - 6.6 `GET /api/v1/dashboard/stats` (Redis-Cached Multi-Role Dashboard)
7. [7. Testing Framework, Coverage & QA Handover Plan](#7-testing-framework-coverage--qa-handover-plan)
   - 7.1 Pytest Strategy & Test Types
   - 7.2 Executable Unit & Integration Test Implementations
   - 7.3 Coverage Criteria & CI/CD Pipeline
8. [8. QA Test Execution Matrix & Sign-off Checklist](#8-qa-test-execution-matrix--sign-off-checklist)

---

## 1. Executive Summary & Architecture Overview

The **Team Hub Capstone** is an enterprise workspace management and real-time task orchestration engine. The system provides role-based workspaces for administrators, project managers, and contributors to manage project lifecycles, assign tasks with status boards, monitor workspace metrics, and track activity audit trails.

### Core Architecture Highlights
- **FastAPI ASGI Backend:** High-concurrency Python 3.12 microframework with asynchronous route handlers (`async/await`).
- **Standardized RESTful Conventions:** All resource endpoints utilize pluralized nouns without verbs in paths (`/api/v1/tasks`, `/api/v1/projects`, `/api/v1/members`).
- **Dual Serialization Layer:** Next.js frontend sends and receives `camelCase` JSON payloads, while backend Python code enforces standard `snake_case` models using Pydantic v2 `alias_generator`.
- **Relational Integrity with PostgreSQL:** Foreign keys with cascading rules, unique email constraints, and B-Tree indexes on query filtering columns.
- **High-Performance Redis Ephemeral Store:** In-memory key-value caching for dashboard statistics, session tracking, and IP rate limiting.
- **Server-Side Rendered Jinja2 Route:** Operational template view served directly for browser-based login and portal fallback.

---

## 2. System Architecture & Component Interaction

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS FRONTEND (CLIENT)                       │
│  - React 19 / TypeScript / TanStack Query                              │
│  - Payload Format: JSON with camelCase fields                          │
│  - Authorization Header: Bearer <JWT_ACCESS_TOKEN>                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (REST & Jinja2 Template View)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND SERVICE                         │
│  ├── Dependency Injection (get_db, get_current_user, require_role)     │
│  ├── Pydantic v2 CamelCase Serialization & Validation Layer            │
│  ├── Routers: /auth, /projects, /tasks, /members, /dashboard           │
│  ├── Templating Engine: Jinja2 (/task_management/api/v1/login)        │
│  └── Background Tasks Worker: Asynchronous SMTP Email Dispatcher       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │     POSTGRESQL 16      │       │        REDIS 7         │
       │ - Relational Storage   │       │ - Session token store  │
       │ - Foreign Keys & ACID  │       │ - IP Rate-limiting     │
       │ - Indexes & Migrations │       │ - KPI Cache (TTL: 60s) │
       └────────────────────────┘       └────────────────────────┘
```

---

## 3. Database Architecture (PostgreSQL 16)

### 3.1 Entity Relationship Diagram (ERD)

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
        BOOLEAN requires_password_change
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

### 3.2 Tables, Data Types & Indexes

| Table Name | Column | Type | Constraints | Description |
|---|---|---|---|---|
| `users` | `id` | `UUID` | Primary Key, `uuid_generate_v4()` | Unique User ID |
| `users` | `email` | `VARCHAR(255)` | Unique, Not Null, Index | User login email |
| `users` | `hashed_password` | `VARCHAR(255)` | Not Null | Bcrypt hash |
| `users` | `role` | `VARCHAR(50)` | Not Null, Default `'member'` | Roles: `admin`, `manager`, `member` |
| `users` | `requires_password_change` | `BOOLEAN` | Not Null, Default `false` | Forces password change for invited members |
| `projects` | `id` | `UUID` | Primary Key, `uuid_generate_v4()` | Unique Project ID |
| `projects` | `name` | `VARCHAR(255)` | Not Null, Index | Project title |
| `projects` | `status` | `VARCHAR(50)` | Not Null, Index | `planning`, `active`, `completed`, `archived` |
| `projects` | `progress` | `INTEGER` | Check `(progress BETWEEN 0 AND 100)` | Completion percentage |
| `project_members` | `project_id`, `user_id` | `UUID` | Composite Primary Key, Cascading FK | Many-to-Many membership |
| `tasks` | `id` | `UUID` | Primary Key | Unique Task ID |
| `tasks` | `project_id` | `UUID` | Foreign Key `projects(id)` ON DELETE CASCADE | Parent project |
| `tasks` | `assignee_id` | `UUID` | Foreign Key `users(id)` ON DELETE SET NULL | Assigned user |
| `tasks` | `status` | `VARCHAR(50)` | Not Null, Index | `todo`, `in-progress`, `review`, `done` |
| `tasks` | `tags` | `JSONB` | Default `'[]'` | Flexible string tag array |
| `project_activities`| `project_id` | `UUID` | Foreign Key `projects(id)` ON DELETE CASCADE | Audit log parent |

### 3.3 Production DDL Script

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'guest')),
    designation VARCHAR(150) DEFAULT 'Contributor',
    requires_password_change BOOLEAN NOT NULL DEFAULT false,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

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

CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_project VARCHAR(50) DEFAULT 'contributor',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (project_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS project_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_name VARCHAR(150) NOT NULL,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- B-Tree Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
```

---

## 4. External Services & Infrastructure

### 4.1 PostgreSQL Connection Pool & Transactions
* **Engine:** `SQLAlchemy 2.0 AsyncEngine` driven by `asyncpg`.
* **Pool Parameters:**
  ```python
  engine = create_async_engine(
      DATABASE_URL,
      pool_size=20,
      max_overflow=10,
      pool_recycle=1800,
      pool_pre_ping=True
  )
  ```
* **Isolation Level:** `READ COMMITTED` ensures isolation without dirty reads while maintaining maximum throughput.

### 4.2 Redis 7 Cache & Session Store
* **Connection Client:** `redis-py` (async client via `redis.asyncio`).
* **Key Lifecycle Specification:**

| Key Pattern | Redis Type | Default TTL | Description |
|---|---|---|---|
| `auth:token:{userId}` | String (Hash) | 604800s (7 Days) | Active session registry. Revoked on logout/password change. |
| `ratelimit:login:{ip}` | Integer | 60 seconds | Throttles brute-force attempts (Max 5 attempts / min). |
| `cache:dashboard:stats:{role}` | String (JSON) | 60 seconds | Caches intensive KPI queries; invalidated on task status mutations. |
| `cache:analytics:overview` | String (JSON) | 300 seconds | High-aggregation chart datasets cache. |

### 4.3 Async SMTP Email Service (`aiosmtplib`)
When an Admin invites a team member via `POST /api/v1/members/invite`:
1. The backend generates a cryptographically secure 12-character alphanumeric temporary password.
2. The user record is created in PostgreSQL with `requires_password_change = true`.
3. An asynchronous background task dispatches an HTML email containing login details via `aiosmtplib`.
4. **Security Guarantee:** The temporary password is never returned to the frontend or exposed to the Admin.

---

## 5. Data Validation & Pydantic v2 Contract

### 5.1 CamelCase Translation Foundation

```python
# backend/schemas/base.py
import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

class CamelCaseModel(BaseModel):
    """
    Base schema for all API request bodies and response schemas.
    Accepts & outputs camelCase JSON for the Next.js frontend,
    while mapping to snake_case Python attributes in backend logic.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True
    )
```

### 5.2 Auth Schemas

```python
class LoginRequest(CamelCaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class UserRead(CamelCaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    role: str
    designation: Optional[str] = None
    requires_password_change: bool = False
    joining_date: Optional[date] = None

class LoginResponse(CamelCaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserRead

class ChangePasswordRequest(CamelCaseModel):
    email: EmailStr
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
```

### 5.3 Task Schemas

```python
class TaskCreate(CamelCaseModel):
    project_id: uuid.UUID
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = ""
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    status: str = Field(default="todo", pattern="^(todo|in-progress|review|done)$")
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    tags: List[str] = Field(default_factory=list)

class TaskUpdate(CamelCaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    status: Optional[str] = Field(None, pattern="^(todo|in-progress|review|done)$")
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    tags: Optional[List[str]] = None

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

### 5.4 Project Schemas

```python
class ProjectCreate(CamelCaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = ""
    status: str = Field(default="planning", pattern="^(planning|active|completed|on-hold|archived)$")
    category: str = "General"
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    start_date: date
    due_date: date
    member_ids: List[uuid.UUID] = Field(default_factory=list)

class ProjectResponse(CamelCaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    status: str
    category: str
    priority: str
    start_date: date
    due_date: date
    progress: int
    created_at: datetime
    updated_at: datetime
```

### 5.5 Member Schemas

```python
class MemberInvite(CamelCaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    designation: Optional[str] = "Contributor"
    joining_date: Optional[date] = None

class MemberInviteResponse(CamelCaseModel):
    message: str
    member: UserRead
```

---

## 6. Comprehensive API Endpoint Specifications

### 6.1 `POST /task_management/api/v1/login` (Authentication Flow)

#### Execution Sequence Diagram
```
Client (Next.js)            FastAPI Router              Redis               PostgreSQL
      │                           │                       │                      │
      ├─── POST /login (JSON) ───►│                       │                      │
      │                           ├── Check Rate Limit ──►│                      │
      │                           │◄── Allowed (Count<5) ─┤                      │
      │                           ├────── Query User by Email ──────────────────►│
      │                           │◄───── Return User Row & Password Hash ───────┤
      │                           │ (Verify bcrypt hash)                         │
      │                           ├── Store Session Token ─►│                    │
      │                           │◄── Token Stored ───────┤                     │
      │◄── 200 OK (JWT + User) ───┤                       │                      │
```

#### Test Scenarios:

**Scenario 1: Positive Authentication (`200 OK`)**
- **Method:** `POST`
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "email": "sarah.connor@company.com",
  "password": "CorrectPassword123!"
}
```
- **Response Headers:** `Content-Type: application/json`
- **Response Body (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoiYWRtaW4ifQ.sample_signature_hash",
  "tokenType": "Bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "sarah.connor@company.com",
    "name": "Sarah Connor",
    "role": "admin",
    "designation": "Lead QA Engineer",
    "requiresPasswordChange": false,
    "joiningDate": "2026-01-15"
  }
}
```

**Scenario 2: Negative Authentication — Invalid Credentials (`401 Unauthorized`)**
- **Request Body:**
```json
{
  "email": "sarah.connor@company.com",
  "password": "WrongPassword!"
}
```
- **Response Body (`401 Unauthorized`):**
```json
{
  "type": "https://teamhub.internal/errors/unauthorized",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "Email or password did not match our records."
}
```

**Scenario 3: Negative Authentication — Malformed Validation (`422 Unprocessable Content`)**
- **Request Body:**
```json
{
  "email": "invalid-email-address",
  "password": "12"
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

### 6.2 `GET /task_management/api/v1/login` (Jinja2 Template Server-Side Route)

FastAPI serves an HTML template for browser-based direct login, admin fallback, or SSO redirects.

#### Route Implementation
```python
# backend/routers/auth.py
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter(prefix="/task_management/api/v1", tags=["Authentication"])
templates = Jinja2Templates(directory="templates")

@router.get("/login", response_class=HTMLResponse, summary="Serve Jinja2 Login View")
async def get_login_page(request: Request, error: str = None):
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "page_title": "Team Hub - Sign In",
            "app_name": "Team Hub Capstone",
            "version": "1.2.0",
            "error": error
        }
    )
```

#### Jinja2 Template Source (`templates/login.html`)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ page_title }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .card {
            background: #1e293b;
            padding: 2.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            width: 100%;
            max-width: 400px;
        }
        .brand { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.25rem; color: #38bdf8; }
        .subtitle { font-size: 0.875rem; color: #94a3b8; margin-bottom: 1.5rem; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; font-size: 0.85rem; margin-bottom: 0.4rem; color: #cbd5e1; }
        input {
            width: 100%;
            padding: 0.75rem;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #fff;
            box-sizing: border-box;
        }
        button {
            width: 100%;
            padding: 0.75rem;
            background: #0284c7;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 1rem;
        }
        .alert {
            background: #7f1d1d;
            border: 1px solid #ef4444;
            color: #fca5a5;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.85rem;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="brand">{{ app_name }}</div>
        <div class="subtitle">Version {{ version }} &bull; Enterprise Access Portal</div>

        {% if error %}
        <div class="alert">{{ error }}</div>
        {% endif %}

        <form action="/task_management/api/v1/login" method="POST">
            <div class="form-group">
                <label for="email">Work Email</label>
                <input type="email" id="email" name="email" required placeholder="alex@company.com">
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required placeholder="••••••••">
            </div>
            <button type="submit">Sign In to Workspace</button>
        </form>
    </div>
</body>
</html>
```

---

### 6.3 `POST /api/v1/tasks` (Create Task)

#### Scenario 1: Positive (`201 Created`)
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
  "title": "Configure Redis connection pool",
  "description": "Set up shared Redis connection pool and health checks",
  "priority": "high",
  "status": "todo",
  "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
  "dueDate": "2026-11-15",
  "tags": ["backend", "redis", "infrastructure"]
}
```
- **Response Body (`201 Created`):**
```json
{
  "id": "e2a44130-9b43-4ce4-893a-86c07a38755b",
  "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
  "title": "Configure Redis connection pool",
  "description": "Set up shared Redis connection pool and health checks",
  "priority": "high",
  "status": "todo",
  "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
  "dueDate": "2026-11-15",
  "tags": ["backend", "redis", "infrastructure"],
  "createdAt": "2026-10-22T13:30:00Z",
  "updatedAt": "2026-10-22T13:30:00Z"
}
```

#### Scenario 2: Negative — Non-Existent Project ID (`404 Not Found`)
- **Response Body (`404 Not Found`):**
```json
{
  "type": "https://teamhub.internal/errors/not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Project with id '00000000-0000-0000-0000-000000000000' does not exist."
}
```

---

### 6.4 `GET /api/v1/projects` & `POST /api/v1/projects` (Project Lifecycle)

#### `GET /api/v1/projects` (List Projects with Role Filtering)
- **Role Rule:** Admins see all workspace projects. Non-admin members receive only projects where they are assigned in `project_members`.
- **Query Parameters:** `status` (optional), `category` (optional), `search` (optional).
- **Response Body (`200 OK`):**
```json
[
  {
    "id": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
    "name": "Team Hub Migration",
    "description": "Migrating to FastAPI and PostgreSQL",
    "status": "planning",
    "category": "Engineering",
    "priority": "high",
    "startDate": "2026-11-01",
    "dueDate": "2026-12-01",
    "progress": 25,
    "createdAt": "2026-10-20T10:00:00Z"
  }
]
```

#### `POST /api/v1/projects` (Create Project — Admin Only)
- **Request Body:**
```json
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
- **Validation Rule:** Backend ensures `dueDate >= startDate`. If invalid, responds with `400 Bad Request`: `{"detail": "dueDate cannot precede startDate"}`.

---

### 6.5 `POST /api/v1/members/invite` (Zero-Knowledge Member Invitation)
- **Role:** Admin Only (`403 Forbidden` if invoked by Member).
- **Request Body:**
```json
{
  "name": "Alex Mercer",
  "email": "alex.mercer@company.com",
  "designation": "Backend Engineer",
  "joiningDate": "2026-11-01"
}
```
- **Response Body (`201 Created`):**
```json
{
  "message": "Invitation email sent to alex.mercer@company.com",
  "member": {
    "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    "email": "alex.mercer@company.com",
    "name": "Alex Mercer",
    "role": "member",
    "designation": "Backend Engineer",
    "requiresPasswordChange": true,
    "joiningDate": "2026-11-01"
  }
}
```

---

### 6.6 `GET /api/v1/dashboard/stats` (Redis-Cached Multi-Role Dashboard)
- **Cache Strategy:** Checked against Redis key `cache:dashboard:stats:{role}` with 60s TTL.
- **Admin Response:** Returns aggregate workspace KPIs (Total Projects, Total Tasks, Active Members, Overdue Tasks, Global Activities).
- **Member Response:** Returns personalized metrics (Assigned Tasks, Due Soon, Overdue, My Projects).

---

## 7. Testing Framework, Coverage & QA Handover Plan

### 7.1 Testing Pyramid
1. **Unit Tests (Pydantic & Domain Logic):** Test serialization, password hashing, and token claims without network calls.
2. **Integration Tests (PostgreSQL & Redis):** Validate constraints, cascading deletions, transaction rollbacks, and Redis TTL.
3. **HTTP API Contract Tests (`httpx.AsyncClient`):** Verify HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `422`).

### 7.2 Executable Unit & Integration Test Implementations

```python
# tests/test_api_v1.py
import pytest
from httpx import AsyncClient
from server.main import app

@pytest.mark.asyncio
async def test_login_positive_flow(async_client: AsyncClient, test_user_fixture):
    """TEST 1: Valid credentials return 200 OK and JWT access token."""
    response = await async_client.post(
        "/task_management/api/v1/login",
        json={
            "email": test_user_fixture["email"],
            "password": "ValidPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data
    assert data["tokenType"] == "Bearer"
    assert data["user"]["email"] == test_user_fixture["email"]

@pytest.mark.asyncio
async def test_login_invalid_password(async_client: AsyncClient, test_user_fixture):
    """TEST 2: Invalid password returns 401 Unauthorized."""
    response = await async_client.post(
        "/task_management/api/v1/login",
        json={
            "email": test_user_fixture["email"],
            "password": "WrongPassword!"
        }
    )
    assert response.status_code == 401
    assert response.json()["status"] == 401

@pytest.mark.asyncio
async def test_jinja2_template_route_renders(async_client: AsyncClient):
    """TEST 3: GET route serves server-side rendered HTML."""
    response = await async_client.get("/task_management/api/v1/login")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Team Hub" in response.text

@pytest.mark.asyncio
async def test_task_creation_positive(async_client: AsyncClient, auth_headers, project_fixture):
    """TEST 4: POST /api/v1/tasks creates a task and returns 201 Created."""
    payload = {
        "projectId": project_fixture["id"],
        "title": "Set up PostgreSQL Schema",
        "description": "Run migrations via Alembic",
        "priority": "high",
        "status": "todo",
        "dueDate": "2026-11-20",
        "tags": ["db", "postgres"]
    }
    response = await async_client.post("/api/v1/tasks", json=payload, headers=auth_headers)
    assert response.status_code == 201
    task = response.json()
    assert task["title"] == "Set up PostgreSQL Schema"
    assert task["projectId"] == project_fixture["id"]

@pytest.mark.asyncio
async def test_task_creation_invalid_project(async_client: AsyncClient, auth_headers):
    """TEST 5: Non-existent project foreign key returns 404 Not Found."""
    payload = {
        "projectId": "00000000-0000-0000-0000-000000000000",
        "title": "Orphan Task",
        "status": "todo",
        "dueDate": "2026-11-20"
    }
    response = await async_client.post("/api/v1/tasks", json=payload, headers=auth_headers)
    assert response.status_code == 404
```

### 7.3 Coverage Criteria & CI/CD Pipeline
- **Enforced Code Coverage:** Minimum **85% branch coverage**.
- **Execution Command:**
  ```bash
  pytest --cov=backend --cov-report=term-missing --cov-report=html --cov-fail-under=85 tests/
  ```

---

## 8. QA Test Execution Matrix & Sign-off Checklist

| Test ID | Module | Endpoint | Verification Target | Expected Result | Pass/Fail |
|---|---|---|---|---|---|
| **AUTH-01** | Auth | `POST /task_management/api/v1/login` | Valid user login | `200 OK`, valid JWT token | [ ] |
| **AUTH-02** | Auth | `POST /task_management/api/v1/login` | Invalid password | `401 Unauthorized` | [ ] |
| **AUTH-03** | Auth | `POST /task_management/api/v1/login` | Malformed email/short password | `422 Unprocessable Content` | [ ] |
| **AUTH-04** | Auth | `GET /task_management/api/v1/login` | Browser navigation | `200 OK`, Jinja2 HTML page rendered | [ ] |
| **TASK-01** | Tasks | `POST /api/v1/tasks` | Create task with valid `projectId` | `201 Created`, camelCase response | [ ] |
| **TASK-02** | Tasks | `POST /api/v1/tasks` | Missing required `title` | `422 Unprocessable Content` | [ ] |
| **TASK-03** | Tasks | `POST /api/v1/tasks` | Non-existent `projectId` | `404 Not Found` | [ ] |
| **PROJ-01** | Projects | `POST /api/v1/projects` | Admin creates project | `201 Created` | [ ] |
| **PROJ-02** | Projects | `POST /api/v1/projects` | Non-admin attempts creation | `403 Forbidden` | [ ] |
| **PROJ-03** | Projects | `POST /api/v1/projects` | `dueDate < startDate` | `400 Bad Request` | [ ] |
| **MEM-01** | Members | `POST /api/v1/members/invite` | Admin invites new member | `201 Created`, zero-knowledge pass | [ ] |
| **MEM-02** | Members | `POST /api/v1/members/invite` | Duplicate email address | `400 Bad Request` / `409 Conflict` | [ ] |
| **DASH-01**| Dashboard | `GET /api/v1/dashboard/stats` | Cache hit on second call | Headers indicate Redis cache hit | [ ] |
