# MASTER_BACKEND_DEVELOPMENT_SPEC.md

# Team Hub — Complete Master Backend Development Specification

**Target Stack:** FastAPI | PostgreSQL | SQLAlchemy 2.0 (Async) | Alembic | Redis | aiosmtplib (SMTP) | pytest  
**Frontend Stack:** Next.js (Pages Router) | React 19 | TypeScript | TanStack React Query v5 | Zustand | Tailwind CSS v4

---

## 1. Project Overview & Architectural Goal

Team Hub is a project management and workspace platform. The frontend is fully built with rich UI/UX (role-based dashboards, multi-step wizards, Kanban boards, analytics charts, and member management).

Currently, the frontend interacts with simulated Next.js API routes writing to a flat JSON file (`data/db.json`). This document provides **the complete, single-source specification** to build a robust, scalable backend in **FastAPI** with **PostgreSQL**, **Redis caching**, **asynchronous SMTP email invitations**, and **JWT authentication**.

### Key Architecture Decision: Zero-Knowledge SMTP Invitations
When an Admin invites a team member, **the temporary password is never shown to the Admin**. The backend automatically generates a secure temporary password, hashes it into PostgreSQL, flags the account with `requires_password_change = true`, and sends the temporary password directly to the user's email via **asynchronous SMTP (`aiosmtplib`)**. The Admin's modal simply receives a success message: `"Invitation email sent to {email}"`.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS FRONTEND (CLIENT)                       │
│  - React Query v5 (Data Fetching & Cache)                              │
│  - Zustand Store (Auth State & Filters)                                │
│  - Headers: Authorization: Bearer <JWT>                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS REST APIs
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND SERVICE                          │
│  ├── Routers: /auth, /projects, /tasks, /members, /dashboard, /analytics│
│  ├── Middleware: CORS, Exception Handlers, JWT Bearer Validator        │
│  ├── Services: Auth, Project, Task, Member, Audit, EmailService (SMTP) │
│  ├── BackgroundTasks: Asynchronous SMTP Email Dispatch                 │
│  └── Caching Layer: Redis Cache (Dashboard KPIs, Blacklist)            │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐       ┌────────────────────────┐
       │   POSTGRESQL 16 (DB)   │       │      REDIS (CACHE)     │
       │ - Users & Roles        │       │ - Dashboard stats TTL  │
       │ - Projects & Members   │       │ - Analytics stats TTL  │
       │ - Tasks & Tags         │       │ - Token revocation     │
       │ - Audit Activities     │       └────────────────────────┘
       └────────────────────────┘
```

---

## 2. Directory Structure of the Backend

The proposed folder layout for the `backend/` directory:

```
backend/
├── alembic/                         # Database migration scripts
│   ├── env.py
│   ├── script.py.mako
│   └── versions/                    # Versioned migration files
├── app/
│   ├── api/                         # API route endpoints (v1)
│   │   ├── deps.py                  # FastAPI dependency injection (get_db, get_current_user, require_admin)
│   │   └── v1/
│   │       ├── router.py            # Aggregated v1 APIRouter
│   │       ├── endpoints/
│   │       │   ├── auth.py          # /login, /change-password, /refresh, /logout
│   │       │   ├── dashboard.py     # /dashboard/stats (role-tailored)
│   │       │   ├── projects.py      # /projects (CRUD, archive, activities)
│   │       │   ├── tasks.py         # /tasks (CRUD, status transitions)
│   │       │   ├── members.py       # /members (list, invite via SMTP, profile, delete)
│   │       │   ├── analytics.py     # /analytics/overview
│   │       │   └── health.py        # /health
│   ├── core/                        # Core app configuration & security
│   │   ├── config.py                # Pydantic BaseSettings (.env loading)
│   │   ├── security.py              # bcrypt hashing, JWT create/decode
│   │   └── redis.py                 # Redis connection client & cache utilities
│   ├── db/                          # Database connection & session
│   │   ├── base.py                  # SQLAlchemy DeclarativeBase
│   │   ├── session.py               # Async engine and async_sessionmaker
│   │   └── init_db.py               # Initial seed script (Admin user)
│   ├── models/                      # SQLAlchemy 2.0 ORM models
│   │   ├── user.py                  # User table
│   │   ├── project.py               # Project & ProjectMember tables
│   │   ├── task.py                  # Task table
│   │   └── activity.py              # ProjectActivity & GlobalActivity tables
│   ├── schemas/                     # Pydantic v2 validation models
│   │   ├── auth.py                  # Token, Login, ChangePassword schemas
│   │   ├── project.py               # ProjectCreate, ProjectUpdate, ProjectOut schemas
│   │   ├── task.py                  # TaskCreate, TaskUpdate, TaskOut schemas
│   │   ├── member.py                # MemberInvite, MemberUpdate, MemberOut schemas
│   │   ├── dashboard.py             # AdminDashboardOut, MemberDashboardOut schemas
│   │   └── analytics.py             # AnalyticsOut schema
│   └── services/                    # Business logic and external services
│       ├── email_service.py         # Asynchronous SMTP mailer (aiosmtplib)
│       ├── audit_service.py         # Automatic activity logger
│       └── stats_service.py         # Dashboard & analytics aggregations
├── tests/                           # Comprehensive test suite (pytest)
│   ├── conftest.py                  # Async client, test DB fixtures, auth tokens
│   ├── test_auth.py
│   ├── test_projects.py
│   ├── test_tasks.py
│   └── test_members.py
├── .env.example
├── alembic.ini
├── Dockerfile
├── requirements.txt
└── main.py                          # FastAPI application entrypoint
```

---

## 3. Database Schema & Models Specification

### 3.1 Relational Architecture (PostgreSQL)

```
                       ┌─────────────────────────────┐
                       │            users            │
                       ├─────────────────────────────┤
                       │ id: UUID (PK)               │
                       │ name: VARCHAR(255)          │
                       │ email: VARCHAR(255) (UQ)    │
                       │ hashed_password: VARCHAR    │
                       │ role: VARCHAR(50)           │
                       │ status: VARCHAR(50)         │
                       │ designation: VARCHAR(255)   │
                       │ joining_date: DATE          │
                       │ requires_password_change: B │
                       │ created_at: TIMESTAMPTZ     │
                       │ updated_at: TIMESTAMPTZ     │
                       └──────────────┬──────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │ 1                          │ 1                          │ 1
         │                            │                            │
         ▼ N                          ▼ N                          ▼ N
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     project_members     │  │          tasks          │  │   project_activities    │
├─────────────────────────┤  ├─────────────────────────┤  ├─────────────────────────┤
│ project_id: UUID (PK,FK)│  │ id: UUID (PK)           │  │ id: UUID (PK)           │
│ user_id: UUID (PK,FK)   │  │ project_id: UUID (FK)   │  │ project_id: UUID (FK)   │
│ assigned_at: TIMESTAMPTZ│  │ title: VARCHAR(255)     │  │ task_id: UUID (FK)      │
└───────────▲─────────────┘  │ description: TEXT       │  │ task_title: VARCHAR(255)│
            │                │ priority: VARCHAR(50)   │  │ user_id: UUID (FK)      │
            │ N              │ status: VARCHAR(50)     │  │ user_name: VARCHAR(255) │
            │                │ assignee_id: UUID (FK)  │  │ from_status: VARCHAR(50)│
            │ 1              │ due_date: DATE          │  │ to_status: VARCHAR(50)  │
┌───────────┴─────────────┐  │ tags: JSONB             │  │ created_at: TIMESTAMPTZ │
│        projects         │  │ created_at: TIMESTAMPTZ │  └─────────────────────────┘
├─────────────────────────┤  │ updated_at: TIMESTAMPTZ │
│ id: UUID (PK)           │  └─────────────────────────┘
│ name: VARCHAR(255)      │
│ description: TEXT       │
│ status: VARCHAR(50)     │
│ category: VARCHAR(100)  │
│ priority: VARCHAR(50)   │
│ start_date: DATE        │
│ due_date: DATE          │
│ end_date: DATE          │
│ previous_status: VARCHAR│
│ created_by: UUID (FK)   │
│ created_at: TIMESTAMPTZ │
│ updated_at: TIMESTAMPTZ │
└─────────────────────────┘
```

### 3.2 SQLAlchemy 2.0 Async Models Implementation (`app/models/`)

```python
# app/models/all_models.py
import uuid
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import String, Text, Boolean, Date, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False) # 'admin' or 'member'
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False) # 'active' or 'invited'
    designation: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    joining_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    requires_password_change: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    projects: Mapped[List["Project"]] = relationship("Project", secondary="project_members", back_populates="members", lazy="selectin")

class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="planning", index=True, nullable=False) # 'planning','active','on_hold','completed','archived'
    category: Mapped[Optional[str]] = mapped_column(String(100), index=True, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(50), default="medium", nullable=True) # 'low','medium','high'
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    previous_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[List[User]] = relationship("User", secondary="project_members", back_populates="projects", lazy="selectin")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan", lazy="selectin")

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", index=True, nullable=False) # 'low','medium','high'
    status: Mapped[str] = mapped_column(String(50), default="todo", index=True, nullable=False) # 'backlog','todo','in_progress','done'
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    due_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project: Mapped[Project] = relationship("Project", back_populates="tasks")
    assignee: Mapped[Optional[User]] = relationship("User")

class ProjectActivity(Base):
    __tablename__ = "project_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    task_title: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False)
    from_status: Mapped[str] = mapped_column(String(50), nullable=False)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

class GlobalActivity(Base):
    __tablename__ = "global_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String(50), nullable=False) # 'task_created', 'task_updated', 'project_created', 'member_invited'
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
```

---

## 4. SMTP Invitation Service Specification

### 4.1 Configuration Requirements (`.env`)
```env
# Database & Security
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/teamhub_db
SECRET_KEY=your-super-secret-jwt-key-min-32-chars-long
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
REDIS_URL=redis://localhost:6379/0

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=no-reply@teamboard.com
SMTP_FROM_NAME="Team Hub"
FRONTEND_URL=http://localhost:3000
```

### 4.2 Async Email Dispatcher (`app/services/email_service.py`)
```python
import os
from email.message import EmailMessage
import aiosmtplib

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@teamboard.com")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Team Hub")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

async def send_invitation_email(recipient_email: str, recipient_name: str, temp_password: str):
    """
    Sends an invitation email with a temporary password asynchronously via aiosmtplib.
    """
    message = EmailMessage()
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
    message["To"] = recipient_email
    message["Subject"] = "Welcome to Team Hub — Your Account Invitation"

    html_content = f"""
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h2 style="color: #1e3a8a; margin-top: 0; font-size: 22px;">Welcome to Team Hub!</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">Hello <strong>{recipient_name}</strong>,</p>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">You have been invited by an administrator to join our workspace. Below are your temporary login credentials:</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0;">
            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Login Email</p>
            <p style="margin: 4px 0 14px 0; font-size: 15px; font-weight: 600; color: #0f172a;">{recipient_email}</p>
            
            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Temporary Password</p>
            <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 18px; font-weight: bold; color: #2563eb; letter-spacing: 1px;">{temp_password}</p>
          </div>
          
          <p style="color: #dc2626; font-size: 13px; font-weight: 500;">
            * Security Notice: You will be required to change this temporary password immediately upon your first login.
          </p>
          
          <div style="margin-top: 28px;">
            <a href="{FRONTEND_URL}/login" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
              Sign In to Your Workspace &rarr;
            </a>
          </div>
        </div>
      </body>
    </html>
    """
    message.add_alternative(html_content, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        start_tls=True,
        username=SMTP_USER,
        password=SMTP_PASSWORD,
    )
```

---

## 5. Complete REST API Endpoints Specification

Base Path: `/api/v1`  
All protected endpoints require: `Authorization: Bearer <access_token>`

### 5.1 Authentication (`/api/v1/auth`)

| Method | Endpoint | Role Required | Request Body | Response Success | Error Codes |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | Public | `{ "email": "...", "password": "..." }` | `{ "access_token": "...", "refresh_token": "...", "token_type": "bearer", "user": { ... } }` | 400, 401 |
| `POST` | `/auth/change-password` | Any Authenticated | `{ "email": "...", "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }` | `{ "message": "Password updated successfully", "user": { ... } }` | 400, 401 |
| `POST` | `/auth/refresh` | Public | `{ "refresh_token": "..." }` | `{ "access_token": "...", "token_type": "bearer" }` | 401 |
| `POST` | `/auth/logout` | Any Authenticated | None | `{ "message": "Logged out successfully" }` (Adds token `jti` to Redis blacklist) | 401 |

### 5.2 Dashboard & Analytics (`/api/v1/dashboard`, `/api/v1/analytics`)

| Method | Endpoint | Role Required | Query Params | Description |
|---|---|---|---|---|
| `GET` | `/dashboard/stats` | Admin or Member | None | Returns **AdminDashboardData** (workspace KPI cards, overdue tasks, global activity) if Admin; returns **MemberDashboardData** (myAssignedTasks, myOverdueTasks, tasksDueSoon, myProjects) if Member. *Cached in Redis (TTL: 60s)*. |
| `GET` | `/analytics/overview` | Admin or Member | `projectId` (optional) | Aggregates tasks by status (for PieChart), tasks by assignee (for BarChart), and 7-day completion trends (for LineChart). *Cached in Redis (TTL: 300s)*. |

### 5.3 Projects (`/api/v1/projects`)

| Method | Endpoint | Role Required | Request Body / Query Params | Description |
|---|---|---|---|---|
| `GET` | `/projects` | Admin or Member | `status`, `category`, `search` | Admins receive all workspace projects; Members receive only projects where they are assigned in `project_members`. |
| `POST` | `/projects` | **Admin Only** | `{ "name": "...", "description": "...", "status": "planning", "category": "...", "priority": "high", "startDate": "...", "dueDate": "...", "memberIds": [...] }` | Validates `dueDate >= startDate`. Creates project and links members in `project_members`. |
| `GET` | `/projects/{id}` | Assigned Member or Admin | None | Returns project details, members list, and task metrics. |
| `PATCH` | `/projects/{id}` | **Admin Only** | Partial project fields | Updates project details, archives/restores project (`status: "archived"`, `previousStatus`). |
| `DELETE` | `/projects/{id}` | **Admin Only** | None | Cascades deletion to associated tasks and project activities. |
| `GET` | `/projects/{id}/activities` | Assigned Member or Admin | None | Returns project task status audit log stream (`taskTitle`, `userName`, `fromStatus`, `toStatus`, `createdAt`). |

### 5.4 Tasks (`/api/v1/tasks`)

| Method | Endpoint | Role Required | Request Body / Query Params | Description |
|---|---|---|---|---|
| `GET` | `/tasks` | Assigned Member or Admin | `projectId`, `status`, `priority`, `assigneeId`, `dueDate` | Queries tasks with dynamic SQL filters. |
| `POST` | `/tasks` | Assigned Member or Admin | `{ "projectId": "...", "title": "...", "description": "...", "priority": "...", "status": "todo", "assigneeId": "...", "dueDate": "...", "tags": [...] }` | Validates that `assigneeId` is a member of the project. Automatically creates `global_activities` record. |
| `GET` | `/tasks/{id}` | Assigned Member or Admin | None | Retrieves task with assignee and project info. |
| `PATCH` | `/tasks/{id}` | Assigned Member or Admin | `{ "status": "in_progress", ... }` | When `status` changes: 1. Updates task, 2. Inserts record into `project_activities`, 3. Inserts record into `global_activities`, 4. Invalidates Redis dashboard cache. |
| `DELETE` | `/tasks/{id}` | **Admin Only** | None | Deletes task permanently. |

### 5.5 Team Members (`/api/v1/members`)

| Method | Endpoint | Role Required | Request Body | Description |
|---|---|---|---|---|
| `GET` | `/members` | Admin or Member | None | Returns list of workspace users (excluding `hashed_password`). |
| `POST` | `/members/invite` | **Admin Only** | `{ "name": "...", "email": "...", "designation": "...", "joiningDate": "..." }` | Generates 12-char secure temporary password, hashes it, sets `requiresPasswordChange = true`, and fires async SMTP email via `BackgroundTasks`. Returns `{ "message": "Invitation email sent to ...", "member": { ... } }`. **Zero password exposure in response.** |
| `PATCH` | `/members/{id}` | Admin (any field & role) or Self (name & designation only) | `{ "name": "...", "designation": "...", "role": "..." }` | Updates user details. Only Admin can modify `role`. |
| `DELETE` | `/members/{id}` | **Admin Only** | None | Deletes member, removes from `project_members`, and sets `assignee_id = NULL` on their assigned tasks. |

---

## 6. Frontend Integration Adjustments

To connect the existing frontend to the new FastAPI backend:

### 6.1 Environment Variable
In Next.js `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 6.2 Switch Custom Headers to JWT Bearer Token
In frontend query hooks (`hooks/useProjects.ts`, `hooks/useProjectTasks.ts`, `hooks/useMembers.ts`), replace custom `x-user-role` and `x-user-id` headers with:
```typescript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
}
```

### 6.3 Clean Up [components/InviteMemberModal.tsx](file:///c:/Users/abhishek/capstone-project/components/InviteMemberModal.tsx)
Remove the `TEMPORARY PASSWORD` input and `Copy Password` button. When the mutation succeeds, simply display:
```tsx
<div className="rounded-xl bg-green-50 p-5 border border-green-200 text-center">
  <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3 font-bold text-xl">✓</div>
  <h3 className="text-sm font-bold text-green-900">Invitation Sent Successfully!</h3>
  <p className="text-xs text-green-700 mt-1">
    An email with temporary login credentials has been sent directly to <strong>{submittedEmail}</strong>.
  </p>
  <button onClick={handleClose} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold">
    Done
  </button>
</div>
```

---

## 7. QA & Pytest Automated Verification Plan

Create pytest suites using `pytest-asyncio` and `httpx.AsyncClient`:

1. **`test_auth.py`**:
   - Verify Admin login (`admin@teamboard.com`, `Admin@123`) returns valid JWT token with claims `role: "admin"`.
   - Verify Member login with wrong password returns `401 Unauthorized`.
   - Verify changing password updates hash in DB and clears `requiresPasswordChange`.
   - Verify user with `requiresPasswordChange: true` receives `403 Forbidden` when accessing project endpoints before updating password.
2. **`test_projects.py`**:
   - Verify Admin can create, patch, archive, and delete projects.
   - Verify Member receives `403 Forbidden` on `POST /projects` and `DELETE /projects/{id}`.
   - Verify Member only receives projects where they are assigned in `GET /projects`.
   - Verify date validation (`dueDate >= startDate`).
3. **`test_tasks.py`**:
   - Verify task status transition from `todo` to `in_progress` creates corresponding `ProjectActivity` record.
   - Verify Member cannot assign task to user outside project member roster.
   - Verify Member cannot delete tasks (`403 Forbidden`).
4. **`test_members.py`**:
   - Verify Admin inviting member triggers `send_invitation_email` mock and creates user with `requires_password_change = True`.
   - Verify response payload does **not** contain temporary password.
   - Verify deleting member sets `tasks.assignee_id = NULL` for tasks assigned to them.
5. **`test_cache.py`**:
   - Verify calling `GET /dashboard/stats` populates Redis cache key.
   - Verify updating task status invalidates Redis cache key.

---

## 8. Summary Checklist Before Development

| Component | Status / Strategy |
|---|---|
| **FastAPI Scaffolding** | Ready to create in `backend/` folder |
| **PostgreSQL & Alembic** | Schema with UUIDs, cascade deletes, foreign keys, and indexes defined |
| **Security & Auth** | bcrypt hashing, HS256 JWT, forced password change flow |
| **Invitation Method** | Asynchronous SMTP via `aiosmtplib` with HTML email template |
| **Admin UI Security** | Zero password exposure in modal or API response |
| **Caching Layer** | Redis caching for dashboard & analytics metrics with auto-invalidation |
| **Testing** | 100% async pytest test suite covering all RBAC edge cases |
