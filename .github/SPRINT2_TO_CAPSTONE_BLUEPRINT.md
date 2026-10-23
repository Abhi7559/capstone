# SPRINT2_TO_CAPSTONE_BLUEPRINT.md

# Team Hub Capstone Backend Blueprint
## Built Using Your Sprint 2 Architecture & Design Patterns

This blueprint uses the **exact code patterns, folder architecture, and conventions** you already mastered in your **Sprint 2 Day 4** project (`c:\Users\abhishek\Desktop\Sprint2\Day4`).

---

## 1. Architectural Architecture Comparison

Notice how your Sprint 2 structure maps 1:1 to the Team Hub Capstone backend:

| Sprint 2 Day 4 (`Desktop\Sprint2\Day4`) | Team Hub Capstone (`backend/`) | Purpose & Responsibility |
|---|---|---|
| `core/config.py` & `security.py` | `core/config.py` & `security.py` | Pydantic Settings, JWT generation & bcrypt hashing |
| `database/engine.py` & `base.py` | `database/engine.py` & `base.py` | Async SQLAlchemy engine, async session factory |
| `database/redis.py` | `database/redis.py` | ConnectionPool, `init_redis()`, `get_redis()` dependency |
| `dependencies/auth.py` | `dependencies/auth.py` | `get_current_user`, `require_role("admin")` HTTPBearer |
| `exceptions/domain.py` & `handlers.py` | `exceptions/domain.py` & `handlers.py` | Domain errors & centralized `@app.exception_handler` |
| `dao/user_dao.py`, `film_dao.py` | `dao/user_dao.py`, `project_dao.py`, `task_dao.py` | Data Access Objects encapsulating pure async SQLAlchemy queries |
| `services/film_service.py` | `services/project_service.py`, `task_service.py` | Business rules, audit logging, Redis caching logic |
| `routes/users.py`, `films.py` | `routes/auth.py`, `projects.py`, `tasks.py`, `members.py` | FastAPI `APIRouter` endpoint controllers |
| `tests/conftest.py`, `test_auth_integration.py` | `tests/conftest.py`, `test_auth_integration.py` | Async SQLite/Postgres test engine & HTTPX client |

---

## 2. Reusing Your Exact Code Patterns

### 2.1 The Redis Dependency Pattern (`database/redis.py`)
We reuse your connection pool and shutdown lifespan pattern directly:
```python
# backend/database/redis.py (Directly from your Sprint 2 Day 4)
from redis.asyncio import ConnectionPool, Redis
from core.config import settings

_redis_pool: ConnectionPool | None = None
_redis_client: Redis | None = None

async def init_redis() -> Redis:
    global _redis_pool, _redis_client
    if _redis_client is None:
        _redis_pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True, max_connections=20)
        _redis_client = Redis(connection_pool=_redis_pool)
    return _redis_client

async def close_redis() -> None:
    global _redis_pool, _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None

async def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        await init_redis()
    return _redis_client
```

---

### 2.2 The HTTPBearer & RBAC Pattern (`dependencies/auth.py`)
We apply your exact `HTTPBearer(auto_error=False)` and `require_role` factory:
```python
# backend/dependencies/auth.py (Directly from your Sprint 2 Day 4)
import uuid
from typing import Any
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from core.security import decode_token
from exceptions.domain import InvalidTokenError, ForbiddenError

security_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    auth_creds: HTTPAuthorizationCredentials | None = Depends(security_bearer),
) -> dict[str, Any]:
    if not auth_creds or not auth_creds.credentials:
        raise InvalidTokenError("Authorization credentials missing or invalid.")
    try:
        payload = decode_token(auth_creds.credentials.strip())
    except JWTError:
        raise InvalidTokenError("Token is invalid or expired.")

    return {
        "user_id": uuid.UUID(payload["sub"]),
        "email": payload.get("email", ""),
        "role": payload.get("role", "member"),
        "name": payload.get("name", ""),
        "requires_password_change": payload.get("requires_password_change", False)
    }

def require_role(*allowed_roles: str):
    async def role_checker(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = (current_user.get("role") or "").lower()
        if user_role not in [r.lower() for r in allowed_roles]:
            raise ForbiddenError(f"Role '{user_role}' does not have permission. Allowed roles: {allowed_roles}.")
        return current_user
    return role_checker
```

---

### 2.3 The DAO Pattern (`dao/project_dao.py`, `dao/task_dao.py`)
Just like `FilmDAO` and `UserDAO`, we encapsulate all queries with `select()`:
```python
# backend/dao/project_dao.py
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.project import Project, ProjectMember

class ProjectDAO:
    async def get_all_for_admin(self, session: AsyncSession) -> list[Project]:
        stmt = select(Project).order_by(Project.created_at.desc())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    async def get_all_for_member(self, session: AsyncSession, user_id: uuid.UUID) -> list[Project]:
        stmt = (
            select(Project)
            .join(ProjectMember, Project.id == ProjectMember.project_id)
            .where(ProjectMember.user_id == user_id)
            .order_by(Project.created_at.desc())
        )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    async def get_by_id(self, session: AsyncSession, project_id: uuid.UUID) -> Project | None:
        stmt = select(Project).where(Project.id == project_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()
```

---

### 2.4 The Service Layer & Redis Caching Pattern (`services/dashboard_service.py`)
Combining DAO queries with Redis caching just like in your Film service:
```python
# backend/services/dashboard_service.py
import json
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from dao.project_dao import ProjectDAO
from dao.task_dao import TaskDAO

class DashboardService:
    def __init__(self, project_dao: ProjectDAO, task_dao: TaskDAO):
        self.project_dao = project_dao
        self.task_dao = task_dao

    async def get_admin_dashboard(self, session: AsyncSession, redis: Redis) -> dict:
        cache_key = "kpi:admin:dashboard"
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Cache miss - compute from PostgreSQL
        total_projects = await self.project_dao.count_all(session)
        tasks = await self.task_dao.get_all(session)
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
        # Cache for 60 seconds
        await redis.setex(cache_key, 60, json.dumps(data))
        return data

    async def invalidate_cache(self, redis: Redis):
        await redis.delete("kpi:admin:dashboard")
```

---

### 2.5 Centralized Domain Exceptions (`exceptions/handlers.py`)
Using your exact `register_exception_handlers(app)` function:
```python
# backend/exceptions/handlers.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from exceptions.domain import ForbiddenError, EntityNotFoundError, ConflictError

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ForbiddenError)
    async def forbidden_handler(request: Request, exc: ForbiddenError):
        return JSONResponse(status_code=403, content={"detail": str(exc), "type": "ForbiddenError"})

    @app.exception_handler(EntityNotFoundError)
    async def not_found_handler(request: Request, exc: EntityNotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc), "type": "NotFoundError"})

    @app.exception_handler(ConflictError)
    async def conflict_handler(request: Request, exc: ConflictError):
        return JSONResponse(status_code=409, content={"detail": str(exc), "type": "ConflictError"})
```

---

### 2.6 The Test Strategy Pattern (`tests/conftest.py`)
Using your exact `pytest-asyncio` fixture setup with async test engine and override dependencies:
```python
# backend/tests/conftest.py (Directly matching your Sprint 2 Day 4 test pattern)
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from database.base import Base
from main import app
from dependencies.db import get_session

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def client(test_engine):
    async_session = async_sessionmaker(test_engine, expire_on_commit=False)
    async def override_get_session():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

---

## 3. The Implementation Action Plan

Because you already have these battle-tested patterns in `Desktop/Sprint2/Day4`, we will build the Capstone backend in **4 direct steps**:

1. **Copy & Adapt Foundation:** Setup `core/`, `database/`, and `exceptions/` directly from your Sprint 2 codebase.
2. **Define Capstone Models & DAOs:** Create `models/` and `dao/` for `User`, `Project`, `Task`, `ProjectActivity`.
3. **Build Capstone Endpoints:** Create routes for `auth.py`, `projects.py`, `tasks.py`, `members.py`, and `dashboard.py`.
4. **Run Integration Tests:** Run `pytest tests/` matching your Sprint 2 test structure.

This ensures you are 100% familiar with every line of code because it uses the exact design patterns you've already mastered!
