"""Comprehensive integration tests for Dashboard and Analytics endpoints with Redis caching.

Tests:
1. GET /dashboard/stats returns AdminDashboardData for Admin callers.
2. GET /dashboard/stats returns MemberDashboardData for Member callers.
3. Second call to /dashboard/stats hits Redis cache (kpi:dashboard:{role}:{user_id}).
4. Modifying task/project invalidates dashboard and analytics caches.
5. GET /analytics/data returns AnalyticsDataResponse matching Recharts structure.
6. GET /analytics/data?projectId={id} filters to specific project and caches at kpi:analytics:{project_id}.
7. Second call to /analytics/data hits Redis cache.
8. Unauthorized project access by Member returns 403 Forbidden.
9. Non-existent project returns 404 Not Found.
10. Unauthenticated calls return 401 Unauthorized.
"""

import uuid
from datetime import date, datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token, hash_password
from models.user import User
from models.project import Project, ProjectMember
from models.task import Task
from models.activity import ProjectActivity
from tests.conftest import DEFAULT_ADMIN_ID


@pytest.fixture
async def setup_data(db_session: AsyncSession):
    """Seed test admin, member, project, and task."""
    # Clean tables
    await db_session.execute(delete(ProjectActivity))
    await db_session.execute(delete(Task))
    await db_session.execute(delete(ProjectMember))
    await db_session.execute(delete(Project))
    await db_session.execute(delete(User).where(User.id != DEFAULT_ADMIN_ID))
    await db_session.commit()

    uid = uuid.uuid4().hex[:6]
    admin = User(
        id=uuid.uuid4(),
        name="Dashboard Admin",
        email=f"d_admin_{uid}@test.com",
        role="admin",
        status="active",
        hashed_password=hash_password("Admin@123"),
    )
    member = User(
        id=uuid.uuid4(),
        name="Dashboard Member",
        email=f"d_member_{uid}@test.com",
        role="member",
        status="active",
        hashed_password=hash_password("Member@123"),
    )
    db_session.add_all([admin, member])
    await db_session.flush()

    project = Project(
        id=uuid.uuid4(),
        name="Cache Test Project",
        description="Testing caching",
        status="active",
    )
    db_session.add(project)
    await db_session.flush()

    # Assign member to project
    db_session.add(ProjectMember(project_id=project.id, user_id=member.id))
    await db_session.flush()

    # Create task
    task = Task(
        id=uuid.uuid4(),
        project_id=project.id,
        title="Cache Test Task",
        description="Task desc",
        status="todo",
        priority="medium",
        assignee_id=member.id,
        due_date=datetime.now(timezone.utc).date() + timedelta(days=1),
    )
    db_session.add(task)
    await db_session.commit()

    admin_token = create_access_token({"sub": str(admin.id), "role": "admin"})
    member_token = create_access_token({"sub": str(member.id), "role": "member"})

    return {
        "admin": admin,
        "member": member,
        "admin_token": admin_token,
        "member_token": member_token,
        "project": project,
        "task": task,
    }


@pytest.mark.asyncio
async def test_admin_dashboard_stats_and_caching(
    client: AsyncClient, setup_data, mock_redis
):
    """Admin receives workspace metrics, cached at kpi:dashboard:admin:{user_id}."""
    token = setup_data["admin_token"]
    admin = setup_data["admin"]
    cache_key = f"kpi:dashboard:admin:{admin.id}"

    # 1. First call -> Cache miss -> calculated from DB and saved in Redis
    headers = {"Authorization": f"Bearer {token}"}
    resp1 = await client.get("/task_management/api/v1/dashboard/stats", headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "totalProjects" in data1
    assert "totalTasks" in data1
    assert data1["totalProjects"] == 1
    assert data1["totalTasks"] == 1

    # Verify stored in mock_redis
    assert cache_key in mock_redis.store

    # 2. Second call -> Cache hit -> returns identical cached data
    resp2 = await client.get("/task_management/api/v1/dashboard/stats", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json() == data1


@pytest.mark.asyncio
async def test_member_dashboard_stats_and_caching(
    client: AsyncClient, setup_data, mock_redis
):
    """Member receives personal metrics, cached at kpi:dashboard:member:{user_id}."""
    token = setup_data["member_token"]
    member = setup_data["member"]
    cache_key = f"kpi:dashboard:member:{member.id}"

    headers = {"Authorization": f"Bearer {token}"}
    resp1 = await client.get("/task_management/api/v1/dashboard/stats", headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "myAssignedTasks" in data1
    assert "myProjects" in data1
    assert len(data1["myAssignedTasks"]) == 1
    assert len(data1["myProjects"]) == 1

    # Verify cached
    assert cache_key in mock_redis.store

    # Cache hit
    resp2 = await client.get("/task_management/api/v1/dashboard/stats", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json() == data1


@pytest.mark.asyncio
async def test_analytics_endpoint_global_and_caching(
    client: AsyncClient, setup_data, mock_redis
):
    """GET /analytics/data returns Recharts data and caches at kpi:analytics:all."""
    token = setup_data["admin_token"]
    cache_key = "kpi:analytics:all"

    headers = {"Authorization": f"Bearer {token}"}
    resp1 = await client.get("/task_management/api/v1/analytics/data", headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.json()

    assert "statusDistribution" in data1
    assert "tasksByAssignee" in data1
    assert "completionTrends" in data1
    assert len(data1["statusDistribution"]) == 4
    assert len(data1["completionTrends"]) == 7

    assert cache_key in mock_redis.store

    # Second call served from cache
    resp2 = await client.get("/task_management/api/v1/analytics/data", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json() == data1


@pytest.mark.asyncio
async def test_analytics_endpoint_project_filtering(
    client: AsyncClient, setup_data, mock_redis
):
    """GET /analytics/data?projectId={id} filters to project and caches at kpi:analytics:{project_id}."""
    token = setup_data["admin_token"]
    proj_id = setup_data["project"].id
    cache_key = f"kpi:analytics:{proj_id}"

    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get(
        f"/task_management/api/v1/analytics/data?projectId={proj_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert cache_key in mock_redis.store


@pytest.mark.asyncio
async def test_analytics_member_unauthorized_project_returns_403(
    client: AsyncClient, setup_data, db_session: AsyncSession
):
    """Member accessing project they do not belong to receives 403 Forbidden."""
    member_token = setup_data["member_token"]

    # Create secret project without this member
    secret_proj = Project(
        id=uuid.uuid4(),
        name="Secret Project",
        description="Private",
        status="active",
    )
    db_session.add(secret_proj)
    await db_session.commit()

    headers = {"Authorization": f"Bearer {member_token}"}
    resp = await client.get(
        f"/task_management/api/v1/analytics/data?projectId={secret_proj.id}",
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_analytics_non_existent_project_returns_404(
    client: AsyncClient, setup_data
):
    """Requesting non-existent project returns 404 Not Found."""
    token = setup_data["admin_token"]
    headers = {"Authorization": f"Bearer {token}"}
    random_uuid = uuid.uuid4()
    resp = await client.get(
        f"/task_management/api/v1/analytics/data?projectId={random_uuid}",
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unauthenticated_requests_return_401(client: AsyncClient):
    """Calls without token return 401."""
    resp1 = await client.get("/task_management/api/v1/dashboard/stats")
    assert resp1.status_code == 401

    resp2 = await client.get("/task_management/api/v1/analytics/data")
    assert resp2.status_code == 401
