"""Comprehensive endpoint tests for all Project routes (Day 3 Step 4: GET, POST, GET/{id}, PATCH/{id}, DELETE/{id})."""

import uuid
from datetime import date
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token, hash_password
from dao.user_dao import user_dao
from dao.project_dao import project_dao


@pytest.fixture
async def setup_users_and_projects(db_session: AsyncSession):
    """Fixture providing Admin, Member, and seeded projects."""
    admin = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Route Admin",
            "email": f"adm_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Admin@123"),
            "role": "admin",
            "status": "active",
        },
    )
    member_assigned = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Assigned Member",
            "email": f"assigned_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
        },
    )
    member_empty = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Empty Member",
            "email": f"empty_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
        },
    )

    # Seed 2 projects: 1 with member_assigned, 1 without
    p1 = await project_dao.create(
        db_session,
        project_data={
            "name": "Assigned Project",
            "description": "Visible to admin and assigned member",
            "status": "active",
            "start_date": date(2026, 11, 1),
            "due_date": date(2026, 11, 30),
        },
        member_ids=[member_assigned.id],
    )
    p2 = await project_dao.create(
        db_session,
        project_data={
            "name": "Admin Only Project",
            "description": "Visible only to admin",
            "status": "planning",
        },
        member_ids=[],
    )

    admin_token = create_access_token({"sub": str(admin.id), "email": admin.email, "role": "admin"})
    assigned_token = create_access_token({"sub": str(member_assigned.id), "email": member_assigned.email, "role": "member"})
    empty_token = create_access_token({"sub": str(member_empty.id), "email": member_empty.email, "role": "member"})

    return {
        "admin": admin,
        "member_assigned": member_assigned,
        "member_empty": member_empty,
        "p1": p1,
        "p2": p2,
        "admin_token": admin_token,
        "assigned_token": assigned_token,
        "empty_token": empty_token,
    }


@pytest.mark.asyncio
async def test_admin_retrieves_all_projects(client: AsyncClient, setup_users_and_projects):
    """1. Admin successfully retrieves all workspace projects."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    response = await client.get("/task_management/api/v1/projects", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    project_ids = [p["id"] for p in data]
    assert str(ctx["p1"].id) in project_ids
    assert str(ctx["p2"].id) in project_ids

    # Verify frontend field casing
    first = data[0]
    assert "startDate" in first or "name" in first
    assert "memberIds" in first


@pytest.mark.asyncio
async def test_member_retrieves_only_assigned_projects(client: AsyncClient, setup_users_and_projects):
    """2. Member retrieves only projects where they are assigned."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['assigned_token']}"}

    response = await client.get("/task_management/api/v1/projects", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    project_ids = [p["id"] for p in data]
    assert str(ctx["p1"].id) in project_ids
    assert str(ctx["p2"].id) not in project_ids


@pytest.mark.asyncio
async def test_member_with_no_projects_receives_empty_list(client: AsyncClient, setup_users_and_projects):
    """3. Authenticated member with no assigned projects receives empty list []."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['empty_token']}"}

    response = await client.get("/task_management/api/v1/projects", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(client: AsyncClient):
    """4. Unauthenticated request without Bearer token is rejected with 401."""
    response = await client.get("/task_management/api/v1/projects")
    assert response.status_code == 401
    res_json = response.json()
    assert "details" in res_json or "detail" in res_json


# ============================================================================
# Tests: POST /projects (Create Project)
# ============================================================================
@pytest.mark.asyncio
async def test_admin_creates_project_success(client: AsyncClient, setup_users_and_projects):
    """5. Admin creates project with valid payload and assigned member, returning 201."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    payload = {
        "name": "Sprint 3 Board",
        "description": "API Integration Sprint",
        "status": "planning",
        "priority": "high",
        "category": "Engineering",
        "startDate": "2026-11-01",
        "dueDate": "2026-11-20",
        "memberIds": [str(ctx["member_assigned"].id)],
    }

    response = await client.post("/task_management/api/v1/projects", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Sprint 3 Board"
    assert data["status"] == "planning"
    assert data["priority"] == "high"
    assert data["startDate"] == "2026-11-01"
    assert data["dueDate"] == "2026-11-20"
    assert str(ctx["member_assigned"].id) in data["memberIds"]


@pytest.mark.asyncio
async def test_member_cannot_create_project(client: AsyncClient, setup_users_and_projects):
    """6. Non-admin member receives 403 Forbidden when calling POST /projects."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['assigned_token']}"}
    payload = {
        "name": "Hacked Board",
        "description": "Should fail",
    }

    response = await client.post("/task_management/api/v1/projects", json=payload, headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_project_invalid_dates_rejected(client: AsyncClient, setup_users_and_projects):
    """7. POST /projects with dueDate earlier than startDate returns 422 validation error."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    payload = {
        "name": "Invalid Dates",
        "description": "Due before start",
        "startDate": "2026-11-20",
        "dueDate": "2026-11-01",
    }

    response = await client.post("/task_management/api/v1/projects", json=payload, headers=headers)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_project_unknown_member_rejected(client: AsyncClient, setup_users_and_projects):
    """8. POST /projects with non-existent memberId returns 400 Bad Request."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    fake_member_id = str(uuid.uuid4())
    payload = {
        "name": "Ghost Member Project",
        "description": "Testing non-existent member",
        "memberIds": [fake_member_id],
    }

    response = await client.post("/task_management/api/v1/projects", json=payload, headers=headers)
    assert response.status_code == 400
    res_json = response.json()
    assert "does not exist in workspace" in str(res_json.get("details", ""))


# ============================================================================
# Tests: GET /projects/{id} (Get Project Details)
# ============================================================================
@pytest.mark.asyncio
async def test_admin_gets_project_by_id(client: AsyncClient, setup_users_and_projects):
    """9. Admin can retrieve any project by its UUID."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    p1_id = str(ctx["p1"].id)

    response = await client.get(f"/task_management/api/v1/projects/{p1_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == p1_id
    assert data["name"] == ctx["p1"].name


@pytest.mark.asyncio
async def test_assigned_member_gets_project_by_id(client: AsyncClient, setup_users_and_projects):
    """10. Assigned member can view their project details."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['assigned_token']}"}
    p1_id = str(ctx["p1"].id)

    response = await client.get(f"/task_management/api/v1/projects/{p1_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == p1_id


@pytest.mark.asyncio
async def test_unassigned_member_receives_403(client: AsyncClient, setup_users_and_projects):
    """11. Member not assigned to the project receives 403 Forbidden."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['empty_token']}"}
    p1_id = str(ctx["p1"].id)

    response = await client.get(f"/task_management/api/v1/projects/{p1_id}", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_project_by_id_not_found(client: AsyncClient, setup_users_and_projects):
    """12. Requesting a non-existent project returns 404 Not Found."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    fake_id = str(uuid.uuid4())

    response = await client.get(f"/task_management/api/v1/projects/{fake_id}", headers=headers)
    assert response.status_code == 404


# ============================================================================
# Tests: PATCH /projects/{id} (Update Project & Archive/Restore)
# ============================================================================
@pytest.mark.asyncio
async def test_admin_updates_project_details(client: AsyncClient, setup_users_and_projects):
    """13. Admin can partially update project details."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    p1_id = str(ctx["p1"].id)

    payload = {"name": "Renamed Board", "priority": "low"}
    response = await client.patch(f"/task_management/api/v1/projects/{p1_id}", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Renamed Board"
    assert data["priority"] == "low"
    assert data["description"] == ctx["p1"].description  # Preserved


@pytest.mark.asyncio
async def test_admin_archive_and_restore_lifecycle(client: AsyncClient, setup_users_and_projects):
    """14. Admin can archive and restore a project, preserving previousStatus."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    p1_id = str(ctx["p1"].id)

    # Archive
    res_archive = await client.patch(
        f"/task_management/api/v1/projects/{p1_id}",
        json={"status": "archived"},
        headers=headers,
    )
    assert res_archive.status_code == 200
    data_archived = res_archive.json()
    assert data_archived["status"] == "archived"
    assert data_archived["previousStatus"] == "active"

    # Restore
    res_restore = await client.patch(
        f"/task_management/api/v1/projects/{p1_id}",
        json={"status": "active"},
        headers=headers,
    )
    assert res_restore.status_code == 200
    data_restored = res_restore.json()
    assert data_restored["status"] == "active"
    assert data_restored["previousStatus"] is None


@pytest.mark.asyncio
async def test_member_cannot_update_project(client: AsyncClient, setup_users_and_projects):
    """15. Regular member receives 403 Forbidden when calling PATCH /projects/{id}."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['assigned_token']}"}
    p1_id = str(ctx["p1"].id)

    response = await client.patch(
        f"/task_management/api/v1/projects/{p1_id}",
        json={"name": "Hacked"},
        headers=headers,
    )
    assert response.status_code == 403


# ============================================================================
# Tests: DELETE /projects/{id} (Delete Project)
# ============================================================================
@pytest.mark.asyncio
async def test_member_cannot_delete_project(client: AsyncClient, setup_users_and_projects):
    """16. Regular member receives 403 Forbidden when calling DELETE /projects/{id}."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['assigned_token']}"}
    p1_id = str(ctx["p1"].id)

    response = await client.delete(f"/task_management/api/v1/projects/{p1_id}", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_deletes_project_success(client: AsyncClient, setup_users_and_projects):
    """17. Admin can delete a project, returning 200 OK with success confirmation."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    p2_id = str(ctx["p2"].id)

    response = await client.delete(f"/task_management/api/v1/projects/{p2_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Project deleted successfully."

    # Verify project is gone
    get_res = await client.get(f"/task_management/api/v1/projects/{p2_id}", headers=headers)
    assert get_res.status_code == 404


# ============================================================================
# Tests: GET /projects Pagination & Filters (QA.md API 6)
# ============================================================================
@pytest.mark.asyncio
async def test_admin_gets_paginated_projects(client: AsyncClient, setup_users_and_projects):
    """18. Admin requests projects with page and pageSize query parameters."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    response = await client.get(
        "/task_management/api/v1/projects?page=1&pageSize=1", headers=headers
    )
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "pagination" in data
    assert len(data["items"]) == 1
    assert "progress" in data["items"][0]
    pagination = data["pagination"]
    assert pagination["page"] == 1
    assert pagination["pageSize"] == 1
    assert pagination["totalItems"] >= 2
    assert pagination["totalPages"] >= 2
    assert pagination["hasNextPage"] is True
    assert pagination["hasPrevPage"] is False


@pytest.mark.asyncio
async def test_admin_filters_projects_by_status_and_search(client: AsyncClient, setup_users_and_projects):
    """19. Filtering by status and search returns matching paginated projects."""
    ctx = setup_users_and_projects
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    unique_name = f"FilterProject_{uuid.uuid4().hex[:8]}"
    create_res = await client.post(
        "/task_management/api/v1/projects",
        json={
            "name": unique_name,
            "description": "Unique description for testing filters",
            "status": "active",
            "category": "engineering",
        },
        headers=headers,
    )
    assert create_res.status_code == 201

    response = await client.get(
        f"/task_management/api/v1/projects?page=1&pageSize=10&status=active&search={unique_name}&category=engineering",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == unique_name
    assert data["items"][0]["status"] == "active"
    assert data["items"][0]["category"] == "Engineering"
    assert data["pagination"]["totalItems"] == 1
    assert data["pagination"]["page"] == 1


@pytest.mark.asyncio
async def test_get_project_activities_endpoint(client: AsyncClient, setup_users_and_projects):
    """20. Retrieve project activities for a project via API 11."""
    ctx = setup_users_and_projects
    admin_headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    project_id = str(ctx["p1"].id)

    # 1. Create a task in project_1
    task_payload = {
        "projectId": project_id,
        "title": "Activity Test Task",
        "description": "Desc",
        "priority": "medium",
        "status": "todo",
        "dueDate": "2026-11-20",
    }
    create_task_res = await client.post("/task_management/api/v1/tasks", json=task_payload, headers=admin_headers)
    assert create_task_res.status_code == 201
    task_id = create_task_res.json()["id"]

    # 2. Update task status to trigger activity logging
    patch_res = await client.patch(
        f"/task_management/api/v1/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=admin_headers,
    )
    assert patch_res.status_code == 200

    # 3. Retrieve activities
    act_res = await client.get(
        f"/task_management/api/v1/projects/{project_id}/activities",
        headers=admin_headers,
    )
    assert act_res.status_code == 200
    activities = act_res.json()
    assert isinstance(activities, list)
    assert len(activities) >= 1
    latest = activities[0]
    assert latest["projectId"] == project_id
    assert latest["fromStatus"] == "todo"
    assert latest["toStatus"] == "in_progress"

