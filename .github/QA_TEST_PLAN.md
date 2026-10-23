# QA_TEST_PLAN.md

## 1. Test Strategy & Frameworks

The backend testing suite uses **pytest**, **pytest-asyncio**, and **HTTPX (`AsyncClient`)** to perform non-blocking integration and unit tests against a temporary test database (PostgreSQL via Docker or SQLite in-memory for unit tests).

- **Framework:** `pytest ^8.0.0`
- **Async Plugin:** `pytest-asyncio ^0.24.0`
- **HTTP Client:** `httpx ^0.27.0`
- **Factory Fixtures:** `factory_boy` / Pytest fixtures for entity generation

---

## 2. Test Suites by Functional Domain

### 2.1 Authentication & Password Security (`test_auth.py`)

| Test ID | Scenario | Type | Description | Expected HTTP Status / Result |
|---|---|---|---|---|
| `AUTH-01` | Admin Login | Happy Path | Login with valid admin credentials (`admin@teamboard.com`, `Admin@123`) | `200 OK`, returns valid JWT with role `'admin'` |
| `AUTH-02` | Member Login | Happy Path | Login with valid member credentials | `200 OK`, returns valid JWT with role `'member'` |
| `AUTH-03` | Invalid Password | Negative | Login with incorrect password | `401 Unauthorized`, `{ "detail": "Invalid email or password" }` |
| `AUTH-04` | Non-existent User | Negative | Login with unregistered email | `401 Unauthorized` |
| `AUTH-05` | Missing Credentials | Validation | Request body missing password or email | `422 Unprocessable Entity` |
| `AUTH-06` | Temporary Password Login | Happy Path | User logs in with temporary password | `200 OK`, `requiresPasswordChange == true` |
| `AUTH-07` | Change Password Success | Happy Path | User rotates password satisfying complexity requirements | `200 OK`, `requiresPasswordChange` reset to `false` |
| `AUTH-08` | Change Password Weak | Negative | New password lacks numbers or special characters | `400 Bad Request`, validation message |
| `AUTH-09` | Password Mismatch | Negative | `newPassword != confirmPassword` | `400 Bad Request` |
| `AUTH-10` | Restricted Access During Temp Password | Security | User with `requiresPasswordChange: true` attempts `GET /api/v1/projects` | `403 Forbidden`, access blocked until password change |

### 2.2 Projects Management & RBAC (`test_projects.py`)

| Test ID | Scenario | Type | Description | Expected HTTP Status / Result |
|---|---|---|---|---|
| `PROJ-01` | Create Project as Admin | Happy Path | Admin submits valid 3-step project data | `201 Created`, project stored with members |
| `PROJ-02` | Create Project as Member | Security | Member user attempts `POST /api/v1/projects` | `403 Forbidden`, action blocked |
| `PROJ-03` | Invalid Dates | Validation | `dueDate < startDate` | `400 Bad Request` |
| `PROJ-04` | List Projects - Admin | Happy Path | Admin calls `GET /api/v1/projects` | `200 OK`, returns all projects in workspace |
| `PROJ-05` | List Projects - Member Isolation | Security | Member calls `GET /api/v1/projects` | `200 OK`, returns ONLY projects where user is assigned |
| `PROJ-06` | Archive Project | Happy Path | Admin patches status to `archived` | `200 OK`, status updated, previousStatus saved |
| `PROJ-07` | Delete Project as Admin | Happy Path | Admin deletes project | `200 OK`, cascaded tasks removed |
| `PROJ-08` | Delete Project as Member | Security | Member attempts `DELETE /api/v1/projects/{id}` | `403 Forbidden` |

### 2.3 Tasks & Audit Stream (`test_tasks.py`)

| Test ID | Scenario | Type | Description | Expected HTTP Status / Result |
|---|---|---|---|---|
| `TASK-01` | Create Task in Project | Happy Path | Member creates task in project they belong to | `201 Created`, task created with tags |
| `TASK-02` | Create Task Outside Project | Security | Member attempts creating task in project they are not assigned to | `403 Forbidden` |
| `TASK-03` | Invalid Assignee | Validation | Assignee UUID is not part of the project's member roster | `400 Bad Request` |
| `TASK-04` | Filter Tasks by Status & Assignee | Happy Path | `GET /api/v1/tasks?projectId={id}&status=todo` | `200 OK`, returns filtered subset |
| `TASK-05` | Status Progression & Audit Log | Side Effect | Transition task from `todo` to `in_progress` | `200 OK`, new entry automatically generated in `project_activities` |
| `TASK-06` | Delete Task as Admin | Happy Path | Admin deletes task | `200 OK` |
| `TASK-07` | Delete Task as Member | Security | Member attempts `DELETE /api/v1/tasks/{id}` | `403 Forbidden` |

### 2.4 Team Members & Invitation (`test_members.py`)

| Test ID | Scenario | Type | Description | Expected HTTP Status / Result |
|---|---|---|---|---|
| `MEM-01` | Invite Member as Admin | Happy Path | Admin invites new email | `201 Created`, temp password returned, `requires_password_change: true` |
| `MEM-02` | Invite Duplicate Email | Negative | Admin invites existing email | `409 Conflict`, error detail returned |
| `MEM-03` | Invite Member as Member | Security | Member attempts `POST /api/v1/members/invite` | `403 Forbidden` |
| `MEM-04` | Update Own Profile | Happy Path | Member updates own name and designation | `200 OK` |
| `MEM-05` | Elevate Role as Member | Security | Member attempts to set `role: "admin"` on self | `403 Forbidden` |
| `MEM-06` | Remove Member as Admin | Happy Path | Admin deletes member | `200 OK`, user unlinked from projects and tasks |

### 2.5 Caching & Invalidation (`test_cache.py`)

| Test ID | Scenario | Type | Description | Expected Result |
|---|---|---|---|---|
| `CACHE-01` | Dashboard Stats Cached | Performance | Consecutive requests to `GET /api/v1/dashboard/stats` | Second request served directly from Redis |
| `CACHE-02` | Cache Invalidation on Task Update | Consistency | Task status updated via `PATCH` | Redis cache key `cache:dashboard:admin:stats` is invalidated |

---

## 3. Sample Pytest Implementation

```python
# tests/test_tasks.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_task_status_transition_creates_audit_activity(
    async_client: AsyncClient,
    admin_auth_headers: dict,
    test_project: dict,
    test_task: dict
):
    # Transition status from todo to in_progress
    response = await async_client.patch(
        f"/api/v1/tasks/{test_task['id']}",
        json={"status": "in_progress"},
        headers=admin_auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    # Verify audit activity was logged
    activity_res = await async_client.get(
        f"/api/v1/projects/{test_project['id']}/activities",
        headers=admin_auth_headers
    )
    assert activity_res.status_code == 200
    activities = activity_res.json()
    assert len(activities) > 0
    latest = activities[0]
    assert latest["taskId"] == test_task["id"]
    assert latest["fromStatus"] == "todo"
    assert latest["toStatus"] == "in_progress"
```
