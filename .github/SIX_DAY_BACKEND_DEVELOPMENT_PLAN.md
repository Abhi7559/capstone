# SIX_DAY_BACKEND_DEVELOPMENT_PLAN.md

# Team Hub Capstone — Deep 6-Day Backend Development Master Plan

**Target Architecture:** FastAPI | PostgreSQL 16 | SQLAlchemy 2.0 (Async) | Alembic | Redis | aiosmtplib (SMTP) | pytest | Docker Compose  
**Pattern Alignment:** Based on your **Sprint 2 Day 4** architectural standards (Core, DAO, Services, Dependencies, Centralized Handlers, Tests).

---

## 📅 High-Level Schedule At A Glance

```
┌────────────────────────────────────────────────────────────────────────┐
│                        6-DAY SPRINT ROADMAP                            │
├─────────┬──────────────────────────────────────────────────────────────┤
│  DAY 1  │ Environment, Database Engine, SQLAlchemy Models & Migrations │
├─────────┼──────────────────────────────────────────────────────────────┤
│  DAY 2  │ Security, JWT Authentication, Password Flow & SMTP Invites   │
├─────────┼──────────────────────────────────────────────────────────────┤
│  DAY 3  │ Projects Domain (DAO, Service, Router & Member Relations)    │
├─────────┼──────────────────────────────────────────────────────────────┤
│  DAY 4  │ Tasks Domain (CRUD, Multi-Filters, Kanban Moves & Audit Log) │
├─────────┼──────────────────────────────────────────────────────────────┤
│  DAY 5  │ Dashboard Stats, Analytics Aggregation & Redis Caching Layer │
├─────────┼──────────────────────────────────────────────────────────────┤
│  DAY 6  │ Centralized Handlers, Test Suite, Docker Compose & Verification│
└─────────┴──────────────────────────────────────────────────────────────┘
```

---

## 📆 DAY 1: Environment Setup, Database Engine, Models & Alembic Migrations

### 🎯 Primary Goal:
Set up the `backend/` folder, configure settings, establish async database connectivity, define all SQLAlchemy 2.0 ORM models, and generate the initial Alembic migration.

### 📋 Detailed Step-by-Step Execution:

#### 1. Directory Structure Creation
Create the backend package layout mirroring your Sprint 2 pattern:
```
backend/
├── alembic/
├── core/
│   ├── __init__.py
│   ├── config.py
│   ├── logger.py
│   └── security.py
├── database/
│   ├── __init__.py
│   ├── base.py
│   ├── engine.py
│   └── redis.py
├── dao/
│   ├── __init__.py
├── models/
│   ├── __init__.py
│   ├── user.py
│   ├── project.py
│   ├── task.py
│   └── activity.py
├── schemas/
├── services/
├── routes/
├── dependencies/
├── exceptions/
├── tests/
├── .env
├── .env.example
├── alembic.ini
├── requirements.txt
└── main.py
```

#### 2. Dependencies & Environment
Create `backend/requirements.txt`:
```txt
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.8.0
pydantic-settings>=2.4.0
sqlalchemy[asyncio]>=2.0.35
asyncpg>=0.29.0
alembic>=1.13.0
redis>=5.0.8
bcrypt>=4.2.0
python-jose[cryptography]>=3.3.0
python-multipart>=0.0.9
aiosmtplib>=3.0.1
pytest>=8.3.0
pytest-asyncio>=0.24.0
httpx>=0.27.0
```

#### 3. Configuration & Engine
- Implement `core/config.py` using `pydantic_settings.BaseSettings` for `DATABASE_URL`, `SECRET_KEY`, `REDIS_URL`, `SMTP_*`.
- Implement `database/base.py` (`class Base(DeclarativeBase)`).
- Implement `database/engine.py` using `create_async_engine` with `async_sessionmaker(expire_on_commit=False)` and `get_db` generator.

#### 4. Define All Domain Models
- `models/user.py`: `id` (UUID), `name`, `email` (unique index), `hashed_password`, `role` (`admin`/`member`), `status` (`active`/`invited`), `designation`, `joining_date`, `requires_password_change` (boolean).
- `models/project.py`: `Project` entity (`name`, `description`, `status`, `category`, `priority`, `start_date`, `due_date`, `previous_status`) and `ProjectMember` junction table (`project_id`, `user_id`).
- `models/task.py`: `Task` entity (`project_id`, `title`, `description`, `priority`, `status`, `assignee_id`, `due_date`, `tags` JSONB).
- `models/activity.py`: `ProjectActivity` (audit transitions) & `GlobalActivity` (workspace events).

#### 5. Alembic Setup & Initial Migration
- Initialize Alembic: `alembic init -t async alembic`.
- Edit `alembic/env.py` to import `Base.metadata`.
- Generate migration: `alembic revision --autogenerate -m "create_initial_schema"`.
- Run migration: `alembic upgrade head`.

#### 6. Database Seed Script
Create `database/seed.py` to insert default System Administrator:
- Email: `admin@teamboard.com`
- Password: `Admin@123` (bcrypt hash)
- Role: `admin`

### ✅ Day 1 Validation Deliverables:
- [x] PostgreSQL tables created via Alembic.
- [x] Default Admin seeded and confirmed via `psql` / seed script.
- [x] Database connection verified via a simple script.

---

## 📆 DAY 2: Security, Authentication, Password Rotation & SMTP Email Invites

### 🎯 Primary Goal:
Build full authentication, JWT token issuance, password hashing, forced password change flow, and asynchronous SMTP email delivery for member invitations.

### 📋 Detailed Step-by-Step Execution:

#### 1. Security Utilities (`core/security.py`)
- `hash_password(password: str) -> str` using `bcrypt.hashpw`.
- `verify_password(plain_password: str, hashed_password: str) -> bool`.
- `create_access_token(data: dict, expires_delta: timedelta) -> str`.
- `create_refresh_token(data: dict) -> str`.
- `decode_token(token: str) -> dict`.

#### 2. Auth Schemas (`schemas/auth.py`)
- `LoginRequest`: `email`, `password`.
- `LoginResponse`: `access_token`, `refresh_token`, `token_type`, `user` object.
- `ChangePasswordRequest`: `email`, `currentPassword`, `newPassword`, `confirmPassword`.
- `RefreshTokenRequest`: `refresh_token`.

#### 3. Authentication Dependencies (`dependencies/auth.py`)
- Implement `security_bearer = HTTPBearer(auto_error=False)`.
- Implement `get_current_user`: extracts token, validates claims, checks `requires_password_change`.
- Implement `require_role(*allowed_roles)` factory dependency (rejecting unauthorized roles with 403).

#### 4. Asynchronous SMTP Email Service (`services/email_service.py`)
- Implement `send_invitation_email(email, name, temp_password)` using `aiosmtplib`.
- HTML email template with Team Hub branding, login link, and temporary password.

#### 5. User DAO & Auth Service
- `dao/user_dao.py`: `get_by_email()`, `get_by_id()`, `create_user()`, `update_password()`, `update_user()`.
- `services/auth_service.py`: login verification, token generation, password rotation business logic.

#### 6. Auth Router (`routes/auth.py`)
- `POST /api/v1/auth/login`: verifies credentials, returns JWT.
- `POST /api/v1/auth/change-password`: validates complexity, updates hash, clears `requires_password_change`.
- `POST /api/v1/auth/refresh`: issues new access token.
- `POST /api/v1/auth/logout`: blacklists token ID in Redis.

#### 7. Member Invite Route (`routes/members.py`)
- `POST /api/v1/members/invite` (Admin only):
  - Generates secure random 12-char password.
  - Creates user with `requires_password_change = True`.
  - Dispatches email via FastAPI `BackgroundTasks` (non-blocking).
  - Returns `{ "message": "Invitation sent successfully", "member": user_data }` without leaking the password.

### ✅ Day 2 Validation Deliverables:
- [ ] Admin & Member login return valid JWTs.
- [ ] Invalid credentials return 401.
- [ ] User with `requires_password_change=True` cannot access protected routes.
- [ ] Member invite endpoint dispatches email in background and saves user.

---

## 📆 DAY 3: Projects Domain (DAO, Service, Router & Member Roster)

### 🎯 Primary Goal:
Implement complete project management with role-based access control (Admin creates/edits/deletes; Members view assigned projects), archive/restore lifecycles, and date validations.

### 📋 Detailed Step-by-Step Execution:

#### 1. Project Schemas (`schemas/project.py`)
- `ProjectCreate`: `name`, `description`, `status`, `category`, `priority`, `startDate`, `dueDate`, `memberIds`.
  - Validator: `dueDate >= startDate`.
- `ProjectUpdate`: Partial update schema with `status`, `previousStatus`, etc.
- `ProjectOut`: Full response model matching frontend `Project` interface.

#### 2. Project Data Access Object (`dao/project_dao.py`)
- `get_all_admin(session)`: Returns all projects in workspace.
- `get_all_for_member(session, user_id)`: SQL join through `ProjectMember` returning only assigned projects.
- `get_by_id(session, project_id)`: Fetches project with members eager-loaded (`selectinload`).
- `create(session, project_data, member_ids)`: Creates project and inserts `ProjectMember` junction rows.
- `update(session, project_id, update_data)`: Updates fields and syncs `memberIds`.
- `delete(session, project_id)`: Deletes project (cascading to tasks).

#### 3. Project Service Layer (`services/project_service.py`)
- Enforce business logic:
  - Verify that only Admins can create, edit, archive, or delete projects.
  - Auto-record a `GlobalActivity` entry upon project creation (`"Project [Name] created by [Admin]"`).

#### 4. Projects Router (`routes/projects.py`)
- `GET /api/v1/projects`: Admin gets all; Member gets assigned projects.
- `POST /api/v1/projects`: Admin only. Validates inputs, creates project, returns 201.
- `GET /api/v1/projects/{id}`: Returns project details if caller has access.
- `PATCH /api/v1/projects/{id}`: Admin only. Handles edits and archive/restore toggling.
- `DELETE /api/v1/projects/{id}`: Admin only. Deletes project and linked tasks.

#### 5. Workspace Members Management (`routes/members.py`)
- `GET /api/v1/members`: Lists all members (passwords excluded).
- `PATCH /api/v1/members/{id}`: Updates name/designation (self) or role (admin only).
- `DELETE /api/v1/members/{id}`: Admin only. Deletes member and unassigns tasks.

### ✅ Day 3 Validation Deliverables:
- [ ] Admin creates project with assigned members.
- [ ] Member receives 403 Forbidden when attempting `POST /projects` or `DELETE /projects/{id}`.
- [ ] Member calling `GET /projects` only sees their assigned projects.
- [ ] Archive toggle preserves `previousStatus`.

---

## 📆 DAY 4: Tasks Domain (Kanban, Status Moves, Filtering & Audit Stream)

### 🎯 Primary Goal:
Build task operations, dynamic multi-field filtering, assignee validation against project rosters, and automated audit logging on status transitions.

### 📋 Detailed Step-by-Step Execution:

#### 1. Task Schemas (`schemas/task.py`)
- `TaskCreate`: `projectId`, `title`, `description`, `priority`, `status`, `assigneeId`, `dueDate`, `tags`.
- `TaskUpdate`: Partial updates (specifically `status`, `priority`, `assigneeId`).
- `TaskOut`: Matches frontend `Task` interface.
- `ProjectActivityOut`: Matches frontend activity feed interface (`taskTitle`, `userName`, `fromStatus`, `toStatus`, `createdAt`).

#### 2. Task & Activity DAOs (`dao/task_dao.py`, `dao/activity_dao.py`)
- `task_dao.get_filtered(...)`: Dynamic SQLAlchemy query filtering by `projectId`, `status`, `priority`, `assigneeId`, `dueDate`.
- `task_dao.create(...)`: Inserts task with JSONB tags.
- `task_dao.update(...)`: Updates task attributes and timestamps.
- `task_dao.delete(...)`: Removes task.
- `activity_dao.create_project_activity(...)`: Inserts status change log into `project_activities`.
- `activity_dao.get_by_project(...)`: Returns sorted activity stream for project.

#### 3. Task Service Business Rules (`services/task_service.py`)
- **Assignee Verification:** Check that `assigneeId` is currently assigned to `projectId` in `project_members`. If not, raise `ValidationException("Assignee is not a member of this project")`.
- **Status Progression Audit:** If `update_data.status != task.status`:
  - Insert record into `ProjectActivity` (`fromStatus`, `toStatus`, `taskTitle`, `userName`).
  - Insert summary into `GlobalActivity` (`"[User] moved [Task] from [From] to [To]"`).
  - Trigger Redis cache invalidation for dashboard stats.

#### 4. Tasks Router (`routes/tasks.py`)
- `GET /api/v1/tasks`: Filtered query matching Kanban columns and list view.
- `POST /api/v1/tasks`: Creates task.
- `GET /api/v1/tasks/{id}`: Returns task details.
- `PATCH /api/v1/tasks/{id}`: Updates status/details + writes to audit log.
- `DELETE /api/v1/tasks/{id}`: Admin only.
- `GET /api/v1/projects/{id}/activities`: Returns project audit stream.

### ✅ Day 4 Validation Deliverables:
- [ ] Task creation succeeds with valid project member assignee.
- [ ] Task creation fails with 400 when assignee is not in the project.
- [ ] Status change (`todo` -> `in_progress`) creates entry in `project_activities`.
- [ ] Non-admin cannot delete tasks (403 Forbidden).

---

## 📆 DAY 5: Dashboard Stats, Analytics Aggregations & Redis Caching Layer

### 🎯 Primary Goal:
Implement role-specific dashboard metrics, Recharts analytics calculations, and high-performance Redis caching with automated cache invalidation.

### 📋 Detailed Step-by-Step Execution:

#### 1. Redis Connection Pool (`database/redis.py`)
- Implement your Sprint 2 pattern: `ConnectionPool.from_url`, `init_redis()`, `close_redis()`, and `get_redis()` dependency.

#### 2. Dashboard Service & Aggregations (`services/dashboard_service.py`)
- **Admin Stats Calculation:**
  - `totalProjects`: Count all active projects.
  - `totalTasks`: Count all tasks.
  - `completedTasks`: Count tasks with `status == "done"`.
  - `overdueTasks`: Count tasks where `dueDate < today` and `status != "done"`.
  - `recentlyCreatedTasks`: 5 most recently created tasks.
  - `recentActivity`: 10 most recent records from `global_activities`.
- **Member Stats Calculation:**
  - `myAssignedTasks`: Tasks assigned to `current_user.id`.
  - `myOverdueTasks`: Member's overdue tasks.
  - `tasksDueSoon`: Tasks due within next 72 hours.
  - `myProjects`: Projects where member is assigned.
  - `recentActivity`: Member-relevant activity.

#### 3. Analytics Service (`services/analytics_service.py`)
- Query tasks (filtered by `projectId` if provided):
  - Group by `status` (for Status Distribution Pie Chart).
  - Group by `assignee` (for Workload Bar Chart).
  - Group by completion date over last 7 days (for Velocity Line Chart).

#### 4. Redis Caching Implementation
- In `routes/dashboard.py`:
  - Cache key: `kpi:dashboard:{role}:{user_id}` (TTL: 60s).
  - Check cache first; compute from DB on miss and store in Redis.
- In `routes/analytics.py`:
  - Cache key: `kpi:analytics:{project_id_or_all}` (TTL: 300s).
- **Cache Invalidation:**
  - In `project_service.py` and `task_service.py`, call `invalidate_dashboard_cache()` whenever a project or task is created, updated, or deleted.

### ✅ Day 5 Validation Deliverables:
- [ ] Admin dashboard returns global metrics; Member dashboard returns personal metrics.
- [ ] Second call to `GET /dashboard/stats` is served in <10ms via Redis cache hit.
- [ ] Updating a task status immediately purges stale Redis cache.
- [ ] Analytics endpoint returns exact data structure needed by Recharts.

---

## 📆 DAY 6: Centralized Error Handlers, Test Suite, Docker Compose & Final E2E

### 🎯 Primary Goal:
Wrap the entire backend in centralized exception handlers, write automated integration tests with `pytest`, build the multi-container Docker Compose stack, and verify live frontend integration.

### 📋 Detailed Step-by-Step Execution:

#### 1. Centralized Exception Handlers (`exceptions/handlers.py`)
- Implement your Sprint 2 pattern:
  - `ForbiddenError` -> 403 JSON
  - `EntityNotFoundError` -> 404 JSON
  - `ConflictError` (duplicate email) -> 409 JSON
  - `InvalidCredentialsError` -> 401 JSON
  - `ValidationRuleError` -> 400 JSON
- Register in `main.py` using `register_exception_handlers(app)`.

#### 2. Lifespan & App Entrypoint (`main.py`)
- Setup FastAPI lifespan to initialize and close Redis connection pool cleanly.
- Add CORS middleware allowing `http://localhost:3000`.
- Include all routers under prefix `/api/v1`.

#### 3. Automated Test Suite (`tests/`)
- Setup `tests/conftest.py` with async client and in-memory test database.
- `tests/test_auth.py`: login, bad password, token refresh, password change restriction.
- `tests/test_projects.py`: admin CRUD vs member 403 Forbidden, date validation.
- `tests/test_tasks.py`: task moves, audit log creation, assignee validation.
- `tests/test_cache.py`: verify Redis caching and invalidation triggers.

#### 4. Docker Compose Multi-Service Stack
- Create `backend/Dockerfile` (Python 3.11 slim).
- Update root `docker-compose.yml` linking all 4 co-located services:
  1. `postgres` (PostgreSQL 16)
  2. `redis` (Redis 7)
  3. `backend` (FastAPI with automated `alembic upgrade head` and `seed.py` on startup)
  4. `frontend` (Next.js)

#### 5. Frontend End-to-End Verification
- Update Next.js frontend to point to `http://localhost:8000/api/v1`.
- Verify full user flow:
  1. Login as Admin.
  2. Create Project.
  3. Invite Member (verify email sent, no password shown in UI).
  4. Create Task & move across Kanban columns.
  5. Check Project Activity feed.
  6. Login as Member, change password, check assigned tasks.

### ✅ Day 6 Validation Deliverables:
- [ ] `pytest` runs with 100% passing test cases.
- [ ] `docker compose up --build` boots all 4 containers cleanly.
- [ ] Frontend operates seamlessly against the real FastAPI backend.

---

## 📊 Summary Progress Tracker

| Day | Focus Area | Key Deliverables | Status |
|:---:|---|---|:---:|
| **Day 1** | **Foundation & Models** | Scaffolding, PostgreSQL models, Alembic migrations, Admin seed | ⏳ Ready |
| **Day 2** | **Auth, JWT & SMTP** | bcrypt, JWT tokens, RBAC dependencies, SMTP email invites | ⏳ Ready |
| **Day 3** | **Projects Domain** | Project CRUD, Admin RBAC, member assignments, archive lifecycle | ⏳ Ready |
| **Day 4** | **Tasks & Kanban** | Task CRUD, multi-filters, status progression audit stream | ⏳ Ready |
| **Day 5** | **Dashboard & Redis** | Dashboard KPIs, Recharts analytics, Redis caching & invalidation | ⏳ Ready |
| **Day 6** | **QA, Docker & E2E** | Centralized handlers, pytest suite, Docker Compose, frontend test | ⏳ Ready |
