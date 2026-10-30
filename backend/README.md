# Team Hub FastAPI Backend

Asynchronous REST API engine for the Team Hub project management platform.

---

## 🛠️ Stack
- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.0 (Async) + asyncpg
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Migrations:** Alembic
- **Package Manager:** `uv`

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
uv sync
```

### 2. Apply Database Migrations
```bash
uv run alembic upgrade head
```

### 3. Seed Database (Default Administrator)
```bash
uv run python seed.py
```



### 4. Run Test Suite
```bash
uv run pytest
```

### 5. Run Development Server
```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🐳 Running with Docker
The container entrypoint script (`entrypoint.sh`) **automatically executes both database migrations and initial admin user seeding**:

```bash
docker compose up --build
```

---

## 🔑 Default Seed Credentials
- **Email:** `admin@teamboard.com`
- **Password:** `Admin@123`
- **Role:** `admin`
- **User ID:** `550e8400-e29b-41d4-a716-446655440000`
