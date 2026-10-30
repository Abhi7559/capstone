import asyncio
import uuid
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from core.config import settings
from core.security import hash_password
from database.base import Base
from dependencies.db import get_db
from main import app
from models.user import User

import os

# SQLite Test Engine for complete isolation from real PostgreSQL/Redis
TEST_DB_FILE = "./test_mock.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

DEFAULT_ADMIN_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_test_db():
    """Create all database tables in memory, patch async_session_factory, and seed default admin."""
    import database.engine
    import dependencies.db
    database.engine.async_session_factory = TestingSessionLocal
    dependencies.db.async_session_factory = TestingSessionLocal

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        admin = User(
            id=DEFAULT_ADMIN_ID,
            name="System Admin",
            email="admin@teamboard.com",
            hashed_password=hash_password("Admin@123"),
            role="admin",
            status="active",
            designation="System Administrator",
            requires_password_change=False,
        )
        session.add(admin)
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated database session per test with automatic rollback."""
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with get_db overridden to use in-memory SQLite test DB."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


class MockRedis:
    """In-memory Mock Redis implementation for testing without real Redis."""

    def __init__(self):
        self.store = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None):
        self.store[key] = value
        return True

    async def exists(self, key: str) -> int:
        return 1 if key in self.store else 0

    async def delete(self, key: str):
        if key in self.store:
            del self.store[key]
            return 1
        return 0

    async def ping(self):
        return True

    async def aclose(self):
        pass


@pytest.fixture
def mock_redis(monkeypatch):
    """Fixture that intercepts Redis client calls and redirects to MockRedis."""
    fake_redis = MockRedis()
    import database.redis
    monkeypatch.setattr(database.redis, "get_redis_client", lambda: fake_redis)
    monkeypatch.setattr(database.redis, "_redis_client", fake_redis)

    async def override_get_redis():
        return fake_redis

    app.dependency_overrides[database.redis.get_redis] = override_get_redis
    yield fake_redis
    app.dependency_overrides.pop(database.redis.get_redis, None)


@pytest.fixture(autouse=True)
def isolate_email_dispatch(monkeypatch):
    """Ensure tests never send real outbound emails via SMTP."""
    from unittest.mock import AsyncMock
    mock_send = AsyncMock(return_value=True)
    monkeypatch.setattr("services.email_service.send_invitation_email", mock_send)
    monkeypatch.setattr("routes.members.send_invitation_email", mock_send)
    yield mock_send


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Fixture providing a verified active Admin user."""
    from dao.user_dao import user_dao
    admin = await user_dao.get_by_email(db_session, "admin@teamboard.com")
    if not admin:
        admin = await user_dao.create_user(
            db_session,
            {
                "id": uuid.uuid4(),
                "name": "System Admin",
                "email": f"admin_{uuid.uuid4().hex[:6]}@teamboard.com",
                "hashed_password": hash_password("Admin@123"),
                "role": "admin",
                "status": "active",
                "designation": "System Administrator",
                "requires_password_change": False,
            },
        )
    return admin


@pytest_asyncio.fixture
async def member_user(db_session: AsyncSession) -> User:
    """Fixture providing a verified active Member user."""
    from dao.user_dao import user_dao
    member = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Standard Member",
            "email": f"member_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
            "designation": "Software Engineer",
            "requires_password_change": False,
        },
    )
    return member


@pytest_asyncio.fixture
async def admin_token(admin_user: User) -> str:
    """Fixture providing a valid JWT Bearer token for the Admin user."""
    from core.security import create_access_token
    return create_access_token(
        data={"sub": str(admin_user.id), "email": admin_user.email, "role": admin_user.role}
    )


@pytest_asyncio.fixture
async def member_token(member_user: User) -> str:
    """Fixture providing a valid JWT Bearer token for the Member user."""
    from core.security import create_access_token
    return create_access_token(
        data={"sub": str(member_user.id), "email": member_user.email, "role": member_user.role}
    )


@pytest_asyncio.fixture
async def test_project(db_session: AsyncSession, member_user: User):
    """Fixture providing a standard test project with member_user assigned."""
    from datetime import date
    from dao.project_dao import project_dao
    proj = await project_dao.create(
        db_session,
        project_data={
            "name": f"Integration Test Project {uuid.uuid4().hex[:6]}",
            "description": "Project used for Day 6 integration tests",
            "status": "active",
            "priority": "high",
            "start_date": date(2026, 11, 1),
            "due_date": date(2026, 11, 30),
        },
        member_ids=[member_user.id],
    )
    return proj


@pytest_asyncio.fixture
async def test_task(db_session: AsyncSession, test_project, member_user: User):
    """Fixture providing a standard task assigned to member_user."""
    from datetime import date
    from dao.task_dao import task_dao
    task = await task_dao.create_task(
        db_session,
        task_data={
            "project_id": test_project.id,
            "title": f"Integration Test Task {uuid.uuid4().hex[:6]}",
            "description": "Integration task description",
            "status": "todo",
            "priority": "medium",
            "assignee_id": member_user.id,
            "due_date": date(2026, 11, 20),
            "tags": ["testing", "integration"],
        },
    )
    return task
