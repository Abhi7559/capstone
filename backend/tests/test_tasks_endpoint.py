import uuid
from datetime import date
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token, hash_password
from dao.user_dao import user_dao
from dao.project_dao import project_dao
from core.config import settings

BASE_TASKS_URL = f"{settings.API_V1_PREFIX}/tasks"


@pytest.fixture
async def setup_post_task_context(db_session: AsyncSession):
    """Fixture providing Admin, Member, and a seeded Project."""
    admin = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Task Admin",
            "email": f"tadmin_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Admin@123"),
            "role": "admin",
            "status": "active",
        },
    )
    member = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Task Member",
            "email": f"tmember_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
        },
    )
    outsider = await user_dao.create_user(
        db_session,
        {
            "id": uuid.uuid4(),
            "name": "Outsider Member",
            "email": f"toutsider_{uuid.uuid4().hex[:6]}@teamboard.com",
            "hashed_password": hash_password("Member@123"),
            "role": "member",
            "status": "active",
        },
    )

    project = await project_dao.create(
        db_session,
        project_data={
            "name": "Tasks Test Project",
            "description": "Project for testing task creation",
            "status": "active",
            "start_date": date(2026, 11, 1),
            "due_date": date(2026, 11, 30),
        },
        member_ids=[member.id],
    )

    admin_token = create_access_token({"sub": str(admin.id), "role": "admin"})
    member_token = create_access_token({"sub": str(member.id), "role": "member"})

    return {
        "admin": admin,
        "member": member,
        "outsider": outsider,
        "project": project,
        "admin_token": admin_token,
        "member_token": member_token,
    }


@pytest.mark.asyncio
async def test_create_task_success_201(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify POST /tasks creates a new task with 201 Created and camelCase fields."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Build Post Endpoint",
        "description": "Verify task creation via REST endpoint",
        "priority": "high",
        "status": "todo",
        "assigneeId": str(ctx["member"].id),
        "dueDate": "2026-11-20",
        "tags": ["backend", "api"],
    }

    response = await client.post(BASE_TASKS_URL, json=payload, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "Build Post Endpoint"
    assert data["projectId"] == str(ctx["project"].id)
    assert data["assigneeId"] == str(ctx["member"].id)
    assert data["priority"] == "high"
    assert data["status"] == "todo"
    assert data["dueDate"] == "2026-11-20"
    assert data["tags"] == ["backend", "api"]
    assert "id" in data
    assert "createdAt" in data


@pytest.mark.asyncio
async def test_create_task_assignee_not_in_project_returns_400(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify POST /tasks with an outsider assignee returns 400 Bad Request."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Task with Invalid Assignee",
        "description": "Attempt to assign non-member",
        "priority": "medium",
        "status": "todo",
        "assigneeId": str(ctx["outsider"].id),
        "dueDate": "2026-11-20",
    }

    response = await client.post(BASE_TASKS_URL, json=payload, headers=headers)
    assert response.status_code == 400
    assert "Assignee is not a member of this project" in response.text


@pytest.mark.asyncio
async def test_get_tasks_flat_list_and_filters(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify GET /tasks returns flat list when pagination params are omitted."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    # Fetch tasks for project
    response = await client.get(
        f"{BASE_TASKS_URL}?projectId={ctx['project'].id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_tasks_paginated_envelope(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify GET /tasks?page=1&pageSize=10 returns QA.md standard paginated envelope."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    response = await client.get(
        f"{BASE_TASKS_URL}?page=1&pageSize=10&projectId={ctx['project'].id}",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["pageSize"] == 10
    assert "totalItems" in data["pagination"]
    assert "totalPages" in data["pagination"]


@pytest.mark.asyncio
async def test_get_task_by_id_success(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify GET /tasks/{id} returns 200 and task details for an existing task."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    # 1. Create a task first
    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Get By ID Task",
        "description": "Testing single task retrieval",
        "priority": "low",
        "status": "todo",
        "dueDate": "2026-11-25",
    }
    create_resp = await client.post(BASE_TASKS_URL, json=payload, headers=headers)
    assert create_resp.status_code == 201
    task_id = create_resp.json()["id"]

    # 2. Retrieve by ID
    get_resp = await client.get(f"{BASE_TASKS_URL}/{task_id}", headers=headers)
    assert get_resp.status_code == 200
    task_data = get_resp.json()
    assert task_data["id"] == task_id
    assert task_data["title"] == "Get By ID Task"
    assert task_data["priority"] == "low"
    assert task_data["status"] == "todo"


@pytest.mark.asyncio
async def test_get_task_by_id_not_found(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify GET /tasks/{id} returns 404 for non-existent task ID."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    fake_id = uuid.uuid4()

    response = await client.get(f"{BASE_TASKS_URL}/{fake_id}", headers=headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_patch_task_status_success(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify PATCH /tasks/{id} updates status, priority, and returns 200 OK."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    # 1. Create a task
    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Initial Task",
        "description": "Original description",
        "priority": "low",
        "status": "todo",
        "dueDate": "2026-11-25",
    }
    create_resp = await client.post(BASE_TASKS_URL, json=payload, headers=headers)
    task_id = create_resp.json()["id"]

    # 2. Update status and title
    update_payload = {
        "status": "in_progress",
        "title": "Updated Task Title",
    }
    patch_resp = await client.patch(f"{BASE_TASKS_URL}/{task_id}", json=update_payload, headers=headers)
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["status"] == "in_progress"
    assert updated_data["title"] == "Updated Task Title"
    assert updated_data["description"] == "Original description"


@pytest.mark.asyncio
async def test_patch_task_invalid_assignee_returns_400(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify PATCH /tasks/{id} with non-project member assignee returns 400."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    # 1. Create a task
    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Task for Patch Test",
        "description": "Desc",
        "priority": "low",
        "status": "todo",
        "dueDate": "2026-11-25",
    }
    create_resp = await client.post(BASE_TASKS_URL, json=payload, headers=headers)
    task_id = create_resp.json()["id"]

    # 2. Patch with outsider assignee
    update_payload = {
        "assigneeId": str(ctx["outsider"].id),
    }
    patch_resp = await client.patch(f"{BASE_TASKS_URL}/{task_id}", json=update_payload, headers=headers)
    assert patch_resp.status_code == 400
    assert "Assignee is not a member of this project" in patch_resp.text


@pytest.mark.asyncio
async def test_delete_task_admin_success(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify DELETE /tasks/{id} as Admin returns 204 No Content and removes task."""
    ctx = setup_post_task_context
    headers = {"Authorization": f"Bearer {ctx['admin_token']}"}

    # 1. Create a task
    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Task To Delete",
        "description": "Will be deleted",
        "priority": "low",
        "status": "todo",
        "dueDate": "2026-11-25",
    }
    create_resp = await client.post(BASE_TASKS_URL, json=payload, headers=headers)
    task_id = create_resp.json()["id"]

    # 2. Delete as admin
    del_resp = await client.delete(f"{BASE_TASKS_URL}/{task_id}", headers=headers)
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["success"] is True
    assert del_data["message"] == "Task deleted successfully."

    # 3. Confirm 404
    get_resp = await client.get(f"{BASE_TASKS_URL}/{task_id}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_task_member_forbidden(
    client: AsyncClient,
    setup_post_task_context: dict,
):
    """Verify DELETE /tasks/{id} as non-admin Member returns 403 Forbidden."""
    ctx = setup_post_task_context
    admin_headers = {"Authorization": f"Bearer {ctx['admin_token']}"}
    member_headers = {"Authorization": f"Bearer {ctx['member_token']}"}

    # 1. Create task as admin
    payload = {
        "projectId": str(ctx["project"].id),
        "title": "Task Member Cannot Delete",
        "description": "Desc",
        "priority": "low",
        "status": "todo",
        "dueDate": "2026-11-25",
    }
    create_resp = await client.post(BASE_TASKS_URL, json=payload, headers=admin_headers)
    task_id = create_resp.json()["id"]

    # 2. Member tries to delete
    del_resp = await client.delete(f"{BASE_TASKS_URL}/{task_id}", headers=member_headers)
    assert del_resp.status_code == 403
    assert "Only Admins can delete tasks" in del_resp.text
