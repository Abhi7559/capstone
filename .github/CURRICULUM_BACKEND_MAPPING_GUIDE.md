# CURRICULUM_BACKEND_MAPPING_GUIDE.md

# How Your Previous Curriculum Topics Map Directly to Building This Backend

This guide connects every single topic you learned during your **Backend Track** directly into practical steps to build the **Team Hub (Internal Task Board API)**.

---

## 1. Curriculum Topic to Capstone Feature Mapping

| Topic You Learned in Curriculum | What It Is | How We Apply It to This Backend | Exact Files / Code in Capstone |
|---|---|---|---|
| **1. FastAPI Framework & Routing** | Asynchronous REST APIs, `APIRouter`, path & query parameters | We organize the API into modular versioned routers (`/api/v1/auth`, `/api/v1/projects`, `/api/v1/tasks`, `/api/v1/members`, `/api/v1/dashboard`). | `app/api/v1/endpoints/*.py` |
| **2. Pydantic v2 (Schemas & Validation)** | Data parsing, type enforcement, request & response serialization | Validates inputs (e.g. `email` format, `min_length` on passwords, `dueDate >= startDate`) and strips sensitive data like `hashed_password` before sending responses. | `app/schemas/*.py` |
| **3. Dependency Injection (`Depends`)** | Sharing database sessions and authenticating users cleanly across routes | - `get_db`: Injects PostgreSQL async session per request.<br>- `get_current_user`: Extracts & verifies JWT token.<br>- `require_admin`: Protects Admin-only endpoints. | `app/api/deps.py` |
| **4. PostgreSQL & SQLAlchemy 2.0 (Async)** | Relational tables, foreign keys, relationships, non-blocking queries | - Models: `User`, `Project`, `ProjectMember`, `Task`, `ProjectActivity`, `GlobalActivity`.<br>- Non-blocking `async with session` queries using `asyncpg`. | `app/models/*.py`, `app/db/session.py` |
| **5. Alembic Database Migrations** | Schema version control without losing data | Automatically creates and tracks database revisions (`alembic revision --autogenerate` & `alembic upgrade head`). | `alembic/versions/*.py` |
| **6. Authentication, Passwords & JWT** | `bcrypt` hashing, JWT access & refresh tokens, RBAC security | - Hashes passwords with `bcrypt`.<br>- Issues 30-min access tokens and 7-day refresh tokens.<br>- Enforces role checks (`admin` vs `member`). | `app/core/security.py`, `app/api/v1/endpoints/auth.py` |
| **7. Redis Integration & Caching** | In-memory key-value store, cache invalidation, TTL | - Caches expensive dashboard KPI stats (`kpi:admin:stats` TTL 60s).<br>- Caches analytics aggregations (TTL 300s).<br>- Purges cache automatically when tasks/projects are modified.<br>- Stores revoked tokens (blacklist). | `app/core/redis.py`, `app/services/stats_service.py` |
| **8. Centralized Exception Handling** | Custom exceptions and unified JSON error responses | Custom exception handlers prevent raw 500 errors and return clean error shapes (`{ "detail": "...", "code": "..." }`). | `main.py`, `app/core/exceptions.py` |
| **9. Automated Testing with `pytest`** | Unit and async integration testing, test fixtures | Tests endpoints, RBAC permissions, and edge cases using `pytest-asyncio` and `httpx.AsyncClient` against a test database. | `tests/conftest.py`, `tests/test_*.py` |
| **10. Docker & Docker Compose** | Multi-container application orchestration | Single `docker-compose.yml` linking **FastAPI**, **PostgreSQL**, **Redis**, and the **Next.js Frontend** with automatic migrations and seeding on boot. | `Dockerfile`, `docker-compose.yml` |

---

## 2. Step-by-Step Build Flow (Connecting Your Knowledge)

Here is the natural order to build the backend using what you learned:

```
STEP 1: Database & Schemas (SQLAlchemy + Pydantic)
├── Define tables in SQLAlchemy (User, Project, Task, Activities)
├── Define Pydantic request & response schemas
└── Run Alembic migration to create tables in PostgreSQL

STEP 2: Security & Authentication (Bcrypt + JWT + Dependencies)
├── Implement password hashing with bcrypt
├── Implement JWT token creation & decoding
└── Write FastAPI Dependencies (get_db, get_current_user, require_admin)

STEP 3: Core CRUD Routers (FastAPI Endpoints)
├── Auth Router (/login, /refresh, /change-password)
├── Projects Router (Create/Read/Update/Delete/Archive)
├── Tasks Router (CRUD + multi-field query filters)
└── Members Router (Listing + SMTP invitation)

STEP 4: Business Logic & Audit Stream
├── When a task status changes, automatically write to ProjectActivity
└── Send SMTP email asynchronously using FastAPI BackgroundTasks

STEP 5: Redis Caching Layer
├── Cache /dashboard/stats and /analytics/overview
└── Add cache invalidation triggers inside task/project mutation routes

STEP 6: Quality Assurance & Containerization
├── Write pytest test cases for happy paths and 403 Forbidden checks
└── Package into Dockerfile and docker-compose.yml
```

---

## 3. Concrete Code Snippets Using Your Learned Concepts

### 3.1 Pydantic Validation & Custom Logic (What you learned in Day 2)
```python
# app/schemas/project.py
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str
    status: str = "planning"
    category: Optional[str] = None
    priority: Optional[str] = "medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    member_ids: List[str] = []

    # Business validation you learned:
    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("due_date must be greater than or equal to start_date")
        return self
```

### 3.2 FastAPI Dependency Injection & RBAC (What you learned in Day 3)
```python
# app/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# Role-based restriction you learned:
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
```

### 3.3 Redis Caching & Invalidation (What you learned in Day 4)
```python
# app/api/v1/endpoints/dashboard.py
import json
from fastapi import APIRouter, Depends
from app.core.redis import redis_client

router = APIRouter()

@router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    cache_key = f"dashboard:stats:{current_user.id}:{current_user.role}"
    
    # 1. Check Redis cache first
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 2. If cache miss, calculate from PostgreSQL
    stats = await calculate_stats_from_db(db, current_user)
    
    # 3. Store in Redis with 60-second TTL
    await redis_client.setex(cache_key, 60, json.dumps(stats))
    return stats
```

---

## 4. How to Talk About This in Your Standup or Interview

You can explain your work using this structured flow:

> 1. **"I modeled the domain entities in PostgreSQL using SQLAlchemy 2.0 Async** (`User`, `Project`, `Task`, `ProjectActivity`) and managed the database schema evolution with **Alembic migrations**."
> 2. **"I implemented robust authentication using JWT tokens and bcrypt password hashing**, enforcing strict **Role-Based Access Control (RBAC)** through FastAPI's dependency injection."
> 3. **"I applied Pydantic v2 schemas** to enforce strict input validation, prevent malformed payloads, and format JSON responses."
> 4. **"I integrated Redis for high-performance caching** on expensive aggregation queries like dashboard stats and analytics, and built automatic cache invalidation on task mutations."
> 5. **"I delivered a comprehensive test suite using `pytest-asyncio`** covering all endpoint happy paths and role-boundary security checks."
> 6. **"I packaged the entire stack into a Docker Compose setup** that links FastAPI, PostgreSQL, Redis, and Next.js co-located on a shared network."
