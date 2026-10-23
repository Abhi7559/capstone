# BACKEND_LEARNING_COMPENDIUM.md

# Team Hub Capstone — Complete Backend Curriculum & Implementation Compendium

> **Purpose:** This document consolidates your complete learning syllabus across Python fundamentals, data structures, OOP, async programming, FastAPI, Pydantic v2, PostgreSQL/SQLAlchemy 2.0, Alembic, Redis, testing, and Docker. It provides **direct, enforceable rules and code implementations** to build the **Team Hub (Internal Task Board API)** backend cleanly without anti-patterns.

---

## 1. Project Management, Packaging & Tooling with `uv`

### Concepts Learned:
- **`uv` vs pip/venv:** `uv` is an extremely fast, single-binary Rust tool replacing `pip`, `pip-tools`, `virtualenv`, and `poetry`.
- **`pyproject.toml`:** Declarative metadata standard (PEP 518/621) containing dependencies, project settings, linter rules, and build tools.
- **`uv.lock`:** Exact lockfile capturing resolved dependency versions, hashes, and platforms to guarantee deterministic, reproducible builds across machines and Docker.

### How We Apply It to Team Hub:
We initialize and manage the `backend/` project strictly using `uv`:
```bash
# Initialize backend with uv
uv init backend --app
cd backend

# Add production dependencies
uv add fastapi uvicorn pydantic pydantic-settings sqlalchemy asyncpg alembic redis bcrypt python-jose python-multipart aiosmtplib

# Add development & testing dependencies
uv add --dev pytest pytest-asyncio httpx pytest-mock pytest-cov mypy ruff

# Lock dependencies deterministically
uv lock
```

---

## 2. Python Fundamentals, Typing & Data Structures

### Concepts Learned:
- **Indentation Scoping:** Python enforces indentation (4 spaces).
- **Core Collections:**
  - `list`: Mutable ordered sequence (use for ordered collections of tasks/projects).
  - `dict`: Key-value map preserving insertion order (Python 3.7+).
  - `set`: Unique mutable items with $O(1)$ lookups (use for checking member IDs, tag filtering).
  - `tuple`: Immutable sequence (use for fixed coordinates, composite database keys).
- **Comprehensions:** List, dict, and set comprehensions for clean data transformation.
- **Functions:** Positional args, `*args`, keyword-only args (`*`), `**kwargs`.
- **Type Annotations & Modern Hints:**
  - `T | None` instead of legacy `Optional[T]`.
  - `list[str]`, `dict[str, Any]` (built-in generics, PEP 585).
  - `Callable[[ParamType], ReturnType]`.
- **Advanced Typing:**
  - `TypeVar` and generic classes (used for generic BaseDAO).
  - `Protocol`: Structural subtyping (duck-typing).
  - `Literal`: Restricting string values (e.g. `Literal["admin", "member"]`).
  - `Annotated`: Attaching dependency metadata (`Depends`, `Field`).

### Practical Code Applied in Team Hub:
```python
# backend/core/types.py
from typing import TypeVar, Protocol, Literal
import uuid

T = TypeVar("T")
UserRole = Literal["admin", "member"]
ProjectStatus = Literal["planning", "active", "on_hold", "completed", "archived"]
TaskStatus = Literal["backlog", "todo", "in_progress", "done"]
TaskPriority = Literal["low", "medium", "high"]

# Generic DAO Protocol
class Identifiable(Protocol):
    id: uuid.UUID
```

---

## 3. Object-Oriented Programming (OOP) & Custom Exceptions

### Concepts Learned:
- `__init__`, instance vs class attributes.
- `@property`: Clean computed accessors without explicit getter methods.
- `@classmethod` vs `@staticmethod`.
- Inheritance & `super()`.
- Python Dunder methods (`__repr__`, `__str__`, `__eq__`).
- Custom Exception Hierarchy: Inheriting from `Exception`, storing typed attributes, using `raise from` for exception chaining.
- Context Managers: `with` statement and `__enter__` / `__exit__`.

### Practical Code Applied in Team Hub (`exceptions/domain.py`):
```python
# backend/exceptions/domain.py
import uuid

class DomainException(Exception):
    """Base exception for all business domain errors."""
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code

class EntityNotFoundError(DomainException):
    def __init__(self, entity_name: str, entity_id: uuid.UUID | str):
        super().__init__(f"{entity_name} with ID '{entity_id}' not found.", code="NOT_FOUND")
        self.entity_name = entity_name
        self.entity_id = str(entity_id)

class ForbiddenError(DomainException):
    def __init__(self, message: str = "Permission denied for this resource."):
        super().__init__(message, code="FORBIDDEN")

class ConflictError(DomainException):
    def __init__(self, message: str):
        super().__init__(message, code="CONFLICT")

class InvalidCredentialsError(DomainException):
    def __init__(self, message: str = "Invalid email or password."):
        super().__init__(message, code="INVALID_CREDENTIALS")

class ValidationRuleError(DomainException):
    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_FAILED")
```

---

## 4. Async/Await, Coroutines & Event Loop

### Concepts Learned:
- **Event Loop & Coroutines:** Single-threaded asynchronous concurrency via `async def` and `await`. Coroutines pause on I/O, allowing other requests to be processed.
- `asyncio.gather(*tasks)`: Concurrent execution of independent I/O tasks.
- `async with`: Asynchronous context manager protocol (`__aenter__` and `__aexit__`) for database sessions and HTTP clients.
- `async for`: Asynchronous generators and streaming responses.

### Practical Code Applied in Team Hub:
```python
# Concurrently fetching stats from PostgreSQL & Redis without blocking
async def fetch_overview_metrics(db: AsyncSession, redis: Redis):
    # Running multiple read operations concurrently
    admin_stats, recent_events = await asyncio.gather(
        stats_dao.get_counts(db),
        activity_dao.get_recent(db, limit=10)
    )
    return {**admin_stats, "recentActivity": recent_events}
```

---

## 5. FastAPI Layered Architecture & Routing

### Concepts Learned:
- **Layered Architecture:** Routes $\rightarrow$ Handlers/Services $\rightarrow$ DAOs $\rightarrow$ Database.
  - **Routes:** Request extraction, status codes, response models.
  - **Services:** Pure business rules, role verification, cache coordination.
  - **DAOs (Data Access Objects):** 100% of raw SQLAlchemy queries stay here.
- **Lifespan Manager:** Using `@asynccontextmanager` to initialize and gracefully close Redis connection pools on startup/shutdown.
- **Automatic Swagger/OpenAPI Documentation:** Auto-generated at `/docs` using route annotations and response models.

### Practical Code Applied in Team Hub (`main.py`):
```python
# backend/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from database.redis import init_redis, close_redis
from exceptions.handlers import register_exception_handlers
from routes import auth, projects, tasks, members, dashboard, analytics

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis pool
    await init_redis()
    yield
    # Shutdown: Close connections
    await close_redis()

app = FastAPI(
    title="Team Hub API",
    version=settings.API_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware allowing Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized Exception Handlers
register_exception_handlers(app)

# Include Modular Routers under /api/v1
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["Tasks"])
app.include_router(members.router, prefix="/api/v1/members", tags=["Members"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
```

---

## 6. Pydantic v2 — Schemas, Strict Validation & Serialization

### Concepts Learned:
- `BaseModel` with typed fields.
- **Strict Mode:** Forcing exact types, disabling silent type coercion.
- `Field()` constraints: `min_length`, `max_length`, `ge`, `le`.
- `@field_validator`: Validating single fields (e.g. email normalization).
- `@model_validator(mode="after")`: Cross-field validation (e.g. `dueDate >= startDate`).
- `model_config`: `from_attributes = True` (ORM mode), `str_strip_whitespace = True`.

### Practical Code Applied in Team Hub (`schemas/project.py`):
```python
# backend/schemas/project.py
from pydantic import BaseModel, Field, model_validator, ConfigDict
from datetime import date, datetime
import uuid
from typing import Optional, List
from core.types import ProjectStatus, TaskPriority

class ProjectCreate(BaseModel):
    model_config = ConfigDict(strict=True, str_strip_whitespace=True)

    name: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    status: ProjectStatus = "planning"
    category: Optional[str] = None
    priority: Optional[TaskPriority] = "medium"
    startDate: Optional[date] = None
    dueDate: Optional[date] = None
    memberIds: List[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.startDate and self.dueDate and self.dueDate < self.startDate:
            raise ValueError("dueDate must be greater than or equal to startDate")
        return self

class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    status: ProjectStatus
    category: Optional[str] = None
    priority: Optional[str] = None
    startDate: Optional[date] = None
    dueDate: Optional[date] = None
    endDate: Optional[date] = None
    previousStatus: Optional[str] = None
    memberIds: List[uuid.UUID]
    createdAt: datetime
```

---

## 7. Dependency Injection & Configuration Management

### Concepts Learned:
- **Centralized Settings:** `pydantic_settings.BaseSettings` loading `.env` once at import time. Fail fast on missing critical secrets.
- **FastAPI `Depends()`:** Clean tree-based dependency injection.
- Sharing database sessions per request via `get_db`.
- Protecting routes with `get_current_user` and `require_role`.

### Practical Code Applied in Team Hub:

#### `core/config.py`:
```python
# backend/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    API_VERSION: str = "v1"
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: str = "redis://localhost:6379/0"
    FRONTEND_URL: str = "http://localhost:3000"

    # SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@teamboard.com"

settings = Settings()
```

#### `dependencies/auth.py`:
```python
# backend/dependencies/auth.py
import uuid
from typing import Any
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from core.security import decode_token
from exceptions.domain import InvalidCredentialsError, ForbiddenError

security_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    auth_creds: HTTPAuthorizationCredentials | None = Depends(security_bearer),
) -> dict[str, Any]:
    if not auth_creds or not auth_creds.credentials:
        raise InvalidCredentialsError("Authorization credentials missing or invalid.")
    try:
        payload = decode_token(auth_creds.credentials.strip())
    except JWTError:
        raise InvalidCredentialsError("Token is invalid or expired.")

    if payload.get("requires_password_change") is True:
        # User is restricted until password changed
        raise ForbiddenError("Password change required before accessing workspace resources.")

    return {
        "user_id": uuid.UUID(payload["sub"]),
        "email": payload.get("email", ""),
        "role": payload.get("role", "member"),
        "name": payload.get("name", ""),
    }

def require_role(*allowed_roles: str):
    def role_checker(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = (current_user.get("role") or "").lower()
        if user_role not in [r.lower() for r in allowed_roles]:
            raise ForbiddenError(f"Access restricted. Allowed roles: {', '.join(allowed_roles)}.")
        return current_user
    return role_checker
```

---

## 8. PostgreSQL & SQLAlchemy 2.0 Async + DAO Pattern

### Concepts Learned:
- `create_async_engine` with connection pooling.
- `async_sessionmaker(expire_on_commit=False)` creating request-scoped `AsyncSession`.
- Modern SQLAlchemy 2.0 syntax: `select()`, `insert()`, `update()`, `delete()`.
- `Mapped[...]` and `mapped_column()` type-annotated declarations.
- Direct database isolation inside typed **DAO** classes.

### Practical Code Applied in Team Hub (`dao/project_dao.py`):
```python
# backend/dao/project_dao.py
import uuid
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from models.project import Project, ProjectMember

class ProjectDAO:
    async def get_all_for_admin(self, session: AsyncSession) -> list[Project]:
        stmt = select(Project).options(selectinload(Project.members)).order_by(Project.created_at.desc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_all_for_member(self, session: AsyncSession, user_id: uuid.UUID) -> list[Project]:
        stmt = (
            select(Project)
            .join(ProjectMember, Project.id == ProjectMember.project_id)
            .where(ProjectMember.user_id == user_id)
            .options(selectinload(Project.members))
            .order_by(Project.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, session: AsyncSession, project_id: uuid.UUID) -> Project | None:
        stmt = select(Project).where(Project.id == project_id).options(selectinload(Project.members))
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_all(self, session: AsyncSession) -> int:
        stmt = select(func.count(Project.id))
        result = await session.execute(stmt)
        return result.scalar_one() or 0
```

---

## 9. Alembic Migrations & Data Seeding

### Concepts Learned:
- Migration lifecycle: Initializing Alembic, configuring async `env.py`.
- `alembic revision --autogenerate -m "..."`: Comparing ORM metadata against database schema.
- `alembic upgrade head`: Applying migrations in transaction.
- Separation of Concerns: Schemas live in Alembic; baseline seed data lives in a standalone seed script (`init_db.py`).

### Practical Code Applied in Team Hub (`database/init_db.py`):
```python
# backend/database/init_db.py
import asyncio
from database.engine import async_session_factory
from models.user import User
from core.security import hash_password
from sqlalchemy import select

async def seed_admin():
    async with async_session_factory() as session:
        stmt = select(User).where(User.email == "admin@teamboard.com")
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if not existing:
            admin_user = User(
                name="System Admin",
                email="admin@teamboard.com",
                hashed_password=hash_password("Admin@123"),
                role="admin",
                status="active",
                designation="System Administrator",
                requires_password_change=False
            )
            session.add(admin_user)
            await session.commit()
            print("System Admin account successfully seeded.")

if __name__ == "__main__":
    asyncio.run(seed_admin())
```

---

## 10. Redis In-Memory Caching & Session Store

### Concepts Learned:
- Redis data store, async client with `redis.asyncio.ConnectionPool`.
- Read-through caching pattern.
- Key expiry via **TTL (Time to Live)**.
- Cache invalidation triggers.
- Token blacklist checking.

### Practical Code Applied in Team Hub:
```python
# backend/services/dashboard_service.py
import json
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from dao.project_dao import ProjectDAO
from dao.task_dao import TaskDAO

class DashboardService:
    @staticmethod
    async def get_admin_stats(session: AsyncSession, redis: Redis, project_dao: ProjectDAO, task_dao: TaskDAO) -> dict:
        cache_key = "kpi:admin:dashboard"
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Cache Miss: Calculate from PostgreSQL
        total_projects = await project_dao.count_all(session)
        tasks = await task_dao.get_all(session)
        completed = len([t for t in tasks if t.status == "done"])
        overdue = len([t for t in tasks if t.is_overdue])

        data = {
            "totalProjects": total_projects,
            "totalTasks": len(tasks),
            "completedTasks": completed,
            "overdueTasks": overdue,
            "recentlyCreatedTasks": [t.to_dict() for t in tasks[:5]],
            "recentActivity": []
        }
        # Set 60s TTL
        await redis.setex(cache_key, 60, json.dumps(data))
        return data

    @staticmethod
    async def invalidate_cache(redis: Redis):
        await redis.delete("kpi:admin:dashboard")
```

---

## 11. Middleware, BackgroundTasks & Async SMTP Mailer

### Concepts Learned:
- `FastAPI.middleware("http")`: Request ID generation, latency tracing.
- `BackgroundTasks`: Deferring non-blocking operations (emails) until after the HTTP response has been sent to the client.
- Secure invitations: Auto-generating 12-char alphanumeric passwords, hashing with bcrypt, sending via `aiosmtplib`, and returning zero credentials to the caller.

### Practical Code Applied in Team Hub (`services/email_service.py`):
```python
# backend/services/email_service.py
from email.message import EmailMessage
import aiosmtplib
from core.config import settings

async def send_invitation_email(recipient_email: str, recipient_name: str, temp_password: str):
    message = EmailMessage()
    message["From"] = f"Team Hub <{settings.SMTP_FROM}>"
    message["To"] = recipient_email
    message["Subject"] = "Welcome to Team Hub — Your Workspace Invitation"

    message.add_alternative(f"""
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Team Hub, {recipient_name}!</h2>
        <p>Your workspace administrator has invited you to join.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <p><strong>Login Email:</strong> {recipient_email}</p>
          <p><strong>Temporary Password:</strong> <code style="font-size: 16px; color: #2563eb;">{temp_password}</code></p>
        </div>
        <p style="color: red; font-size: 12px;">* You will be prompted to change this password upon your first login.</p>
        <p><a href="{settings.FRONTEND_URL}/login">Login to Team Hub</a></p>
      </body>
    </html>
    """, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        start_tls=True,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
    )
```

---

## 12. Automated Testing with `pytest` & `pytest-asyncio`

### Concepts Learned:
- `pytest` discovery and `conftest.py` fixture sharing.
- `@pytest.mark.asyncio`: Running async test coroutines with an isolated event loop.
- `httpx.AsyncClient` + `ASGITransport(app=app)`: Testing FastAPI in-memory without starting an HTTP server.
- Dependency overrides: Swapping real PostgreSQL/Redis with SQLite in-memory or mock fixtures.
- Mocking external services (SMTP mailer) using `unittest.mock.AsyncMock`.

### Practical Code Applied in Team Hub (`tests/test_auth_integration.py`):
```python
# backend/tests/test_auth_integration.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_admin_login_success(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={
        "email": "admin@teamboard.com",
        "password": "Admin@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "admin"

@pytest.mark.asyncio
async def test_member_forbidden_on_project_create(client: AsyncClient, member_headers: dict):
    response = await client.post("/api/v1/projects", json={
        "name": "Unauthorized Project",
        "description": "This should fail with 403"
    }, headers=member_headers)
    assert response.status_code == 403
```

---

## 13. Docker & Docker Compose Orchestration

### Concepts Learned:
- Multi-stage Dockerfile: Builder stage with `uv` installing wheels; lightweight slim runtime stage.
- `.dockerignore`: Excluding `.venv`, `.git`, `__pycache__`, `.env`.
- Health checks: `pg_isready` ensuring PostgreSQL is ready before migrations run.
- Named volumes: Persisting PostgreSQL data and Redis snapshots across container restarts.
- Monorepo orchestration: Co-locating **FastAPI**, **PostgreSQL**, **Redis**, and **Next.js** on a unified Docker bridge network.

### Practical Code Applied in Team Hub (`docker-compose.yml`):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: teamhub_db
    environment:
      POSTGRES_DB: teamhub_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgrespassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d teamhub_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: teamhub_redis
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: teamhub_backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgrespassword@postgres:5432/teamhub_db
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: super-secret-capstone-jwt-signing-key
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    command: >
      sh -c "alembic upgrade head &&
             python -m database.init_db &&
             uvicorn main:app --host 0.0.0.0 --port 8000"

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: teamhub_frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000/api/v1
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## 14. Summary & Verification Checklist

This table serves as your development checklist to verify that all concepts you learned are incorporated into the Team Hub Capstone:

- [ ] Project initialized with `uv` and tracked with `pyproject.toml` & `uv.lock`.
- [ ] Strict Pydantic v2 validation models preventing bad data and stripping passwords.
- [ ] Layered architecture implemented: Routes $\rightarrow$ Services $\rightarrow$ DAOs $\rightarrow$ Database.
- [ ] SQLAlchemy 2.0 async syntax (`select()`) encapsulated strictly in `dao/*.py`.
- [ ] Alembic migrations managing PostgreSQL schema evolution cleanly.
- [ ] JWT authentication with bcrypt password hashing and RBAC (`admin` / `member`).
- [ ] Redis caching for dashboard stats with automated cache invalidation.
- [ ] Centralized exception handlers converting domain exceptions into unified JSON responses.
- [ ] Asynchronous SMTP email invitations via `aiosmtplib` and `BackgroundTasks`.
- [ ] Automated pytest integration test suite testing happy paths and role boundaries.
- [ ] Multi-container Docker Compose running PostgreSQL, Redis, FastAPI, and Next.js.
