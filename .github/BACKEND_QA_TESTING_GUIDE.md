# BACKEND_QA_TESTING_GUIDE.md

# Team Hub — Backend API Testing Guide (FastAPI, PostgreSQL & Redis)

**Target Audience:** QA Engineers / API Testers / Automation Engineers  
**Scope:** Backend REST API Testing Only (Excludes Frontend UI)  
**Tools:** Postman / Insomnia / cURL / Swagger UI / pytest  
**Base URL:** `http://localhost:8000/api/v1`  
**Interactive Docs (Swagger):** `http://localhost:8000/docs`  
**Alternative Docs (ReDoc):** `http://localhost:8000/redoc`  

---

## 1. Quick Start for API Testers

### 1.1 Authentication Mechanism
- The API uses **JWT Bearer Token** authentication.
- For all protected endpoints, add the following header:
  ```http
  Authorization: Bearer <your_access_token>
  ```
- **Content-Type:** `application/json`

### 1.2 Default Test Accounts in Seed Database
- **Administrator:** `admin@teamboard.com` | `Admin@123` (Role: `admin`)
- **Regular Member:** `abhishek@gmail.com` | `ABhi@@0099` (Role: `member`)

---

## 2. API Test Suites & Test Cases

---

### Module 1: Authentication & Session Management (`/api/v1/auth`)

#### TC-AUTH-01: Admin Login (Happy Path)
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Payload:**
  ```json
  {
    "email": "admin@teamboard.com",
    "password": "Admin@123"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Assertions:**
  - `access_token` is present, valid JWT string.
  - `refresh_token` is present.
  - `user.role` equals `"admin"`.
  - `user.requiresPasswordChange` is `false`.

#### TC-AUTH-02: Member Login (Happy Path)
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Payload:**
  ```json
  {
    "email": "abhishek@gmail.com",
    "password": "ABhi@@0099"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Assertions:**
  - `user.role` equals `"member"`.

#### TC-AUTH-03: Invalid Password
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Payload:**
  ```json
  {
    "email": "admin@teamboard.com",
    "password": "WrongPassword@999"
  }
  ```
- **Expected Status:** `401 Unauthorized`
- **Expected Body:** `{ "detail": "Invalid email or password" }`

#### TC-AUTH-04: Non-Existent User
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Payload:**
  ```json
  {
    "email": "notfound@teamboard.com",
    "password": "AnyPassword123!"
  }
  ```
- **Expected Status:** `401 Unauthorized`

#### TC-AUTH-05: Missing Payload Fields (Validation)
- **Method:** `POST`
- **Endpoint:** `/auth/login`
- **Payload:** `{ "email": "admin@teamboard.com" }` (Missing password)
- **Expected Status:** `422 Unprocessable Entity`

#### TC-AUTH-06: Token Refresh (Happy Path)
- **Method:** `POST`
- **Endpoint:** `/auth/refresh`
- **Payload:** `{ "refresh_token": "<valid_refresh_token>" }`
- **Expected Status:** `200 OK`
- **Expected Body:** Contains new `access_token`.

#### TC-AUTH-07: Change Password (Happy Path)
- **Method:** `POST`
- **Endpoint:** `/auth/change-password`
- **Headers:** `Authorization: Bearer <member_token>`
- **Payload:**
  ```json
  {
    "email": "abhishek@gmail.com",
    "currentPassword": "ABhi@@0099",
    "newPassword": "BrandNewPassword@2026",
    "confirmPassword": "BrandNewPassword@2026"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Body:** `user.requiresPasswordChange` is `false`.
- **Post-condition:** Login with old password fails (`401`); login with new password succeeds (`200`).

#### TC-AUTH-08: Password Complexity Rule Violation
- **Method:** `POST`
- **Endpoint:** `/auth/change-password`
- **Payload:**
  ```json
  {
    "email": "abhishek@gmail.com",
    "currentPassword": "ABhi@@0099",
    "newPassword": "weakpassword",
    "confirmPassword": "weakpassword"
  }
  ```
- **Expected Status:** `400 Bad Request`
- **Expected Assertion:** Detail explains failure (missing uppercase, number, special char, min 8 chars).

#### TC-AUTH-09: Temporary Password Scope Restriction (Security Test)
- **Scenario:** User with `requires_password_change = true` tries to access project endpoints.
- **Method:** `GET`
- **Endpoint:** `/projects`
- **Headers:** `Authorization: Bearer <temporary_password_user_token>`
- **Expected Status:** `403 Forbidden`
- **Expected Body:** `{ "detail": "Password change required before accessing workspace resources" }`

---

### Module 2: Projects API (`/api/v1/projects`)

#### TC-PROJ-01: List Projects as Admin (View All)
- **Method:** `GET`
- **Endpoint:** `/projects`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Expected Status:** `200 OK`
- **Expected Assertions:** Returns an array of all projects across the entire workspace.

#### TC-PROJ-02: List Projects as Member (Data Isolation)
- **Method:** `GET`
- **Endpoint:** `/projects`
- **Headers:** `Authorization: Bearer <member_token>`
- **Expected Status:** `200 OK`
- **Expected Assertions:** Array contains **only** projects where `memberIds` contains this member's UUID. Unassigned projects are excluded.

#### TC-PROJ-03: Create Project as Admin (Happy Path)
- **Method:** `POST`
- **Endpoint:** `/projects`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Payload:**
  ```json
  {
    "name": "Cloud Migration 2026",
    "description": "Migrate on-prem services to AWS cloud infrastructure",
    "status": "planning",
    "category": "DevOps",
    "priority": "high",
    "startDate": "2026-11-01",
    "dueDate": "2026-12-15",
    "memberIds": ["b733e169-49d4-4d66-b4ef-2460da7a3a30"]
  }
  ```
- **Expected Status:** `201 Created`
- **Expected Assertions:**
  - `id` is a valid UUID string.
  - `status` is `"planning"`.
  - `memberIds` includes the assigned UUID.

#### TC-PROJ-04: Create Project as Member (RBAC Test)
- **Method:** `POST`
- **Endpoint:** `/projects`
- **Headers:** `Authorization: Bearer <member_token>`
- **Payload:** Same as above.
- **Expected Status:** `403 Forbidden`
- **Expected Body:** `{ "detail": "Only administrators can create projects" }`

#### TC-PROJ-05: Date Validation Rule (`dueDate < startDate`)
- **Method:** `POST`
- **Endpoint:** `/projects`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Payload:**
  ```json
  {
    "name": "Invalid Date Project",
    "description": "Testing invalid date validation rules",
    "startDate": "2026-12-01",
    "dueDate": "2026-11-01"
  }
  ```
- **Expected Status:** `400 Bad Request` or `422 Unprocessable Entity`
- **Expected Detail:** `dueDate must be greater than or equal to startDate`.

#### TC-PROJ-06: Archive Project (Lifecycle Test)
- **Method:** `PATCH`
- **Endpoint:** `/projects/{project_id}`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Payload:**
  ```json
  {
    "status": "archived",
    "previousStatus": "active"
  }
  ```
- **Expected Status:** `200 OK`
- **Expected Assertions:** `status` is `"archived"`, `previousStatus` is `"active"`.

#### TC-PROJ-07: Delete Project (Cascade Check)
- **Method:** `DELETE`
- **Endpoint:** `/projects/{project_id}`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Expected Status:** `200 OK`
- **Post-conditions:**
  - Subsequent `GET /projects/{project_id}` returns `404 Not Found`.
  - `GET /tasks?projectId={project_id}` returns an empty list `[]` (tasks cascaded).

#### TC-PROJ-08: Delete Project as Member (RBAC Test)
- **Method:** `DELETE`
- **Endpoint:** `/projects/{project_id}`
- **Headers:** `Authorization: Bearer <member_token>`
- **Expected Status:** `403 Forbidden`

#### TC-PROJ-09: Get Project Activities Audit Feed
- **Method:** `GET`
- **Endpoint:** `/projects/{project_id}/activities`
- **Headers:** `Authorization: Bearer <token>`
- **Expected Status:** `200 OK`
- **Expected Shape:** Array of objects: `[ { "id": "...", "taskId": "...", "taskTitle": "...", "userName": "...", "fromStatus": "todo", "toStatus": "in_progress", "createdAt": "..." } ]`.

---

### Module 3: Tasks API (`/api/v1/tasks`)

#### TC-TASK-01: Create Task (Happy Path)
- **Method:** `POST`
- **Endpoint:** `/tasks`
- **Headers:** `Authorization: Bearer <token>`
- **Payload:**
  ```json
  {
    "projectId": "<valid_project_uuid>",
    "title": "Setup PostgreSQL asyncpg connection pool",
    "description": "Configure database sessionmaker with connection pooling",
    "priority": "high",
    "status": "todo",
    "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    "dueDate": "2026-10-30",
    "tags": ["backend", "database"]
  }
  ```
- **Expected Status:** `201 Created`
- **Expected Assertions:**
  - `id` generated as UUID.
  - `status` is `"todo"`.
  - `tags` is `["backend", "database"]`.

#### TC-TASK-02: Assignee Project Membership Validation
- **Scenario:** Attempting to assign a task to a user who is NOT a member of that project.
- **Method:** `POST`
- **Endpoint:** `/tasks`
- **Payload:** `{ ... "assigneeId": "<user_not_in_project>" }`
- **Expected Status:** `400 Bad Request`
- **Expected Body:** `{ "detail": "Assignee is not a member of this project" }`

#### TC-TASK-03: Filter Tasks by Multi-Field Query Parameters
- **Method:** `GET`
- **Endpoint:** `/tasks?projectId={id}&status=in_progress&priority=high`
- **Headers:** `Authorization: Bearer <token>`
- **Expected Status:** `200 OK`
- **Expected Assertions:** All returned tasks have `status == "in_progress"` AND `priority == "high"`.

#### TC-TASK-04: Task Status Transition & Side Effect Verification
- **Scenario:** Move task from `todo` to `in_progress`.
- **Method:** `PATCH`
- **Endpoint:** `/tasks/{task_id}`
- **Payload:**
  ```json
  {
    "status": "in_progress"
  }
  ```
- **Expected Status:** `200 OK`
- **Side Effect Check:** Query `GET /projects/{project_id}/activities`.
  - First activity in array must have `taskId == task_id`, `fromStatus == "todo"`, `toStatus == "in_progress"`.

#### TC-TASK-05: Delete Task as Admin
- **Method:** `DELETE`
- **Endpoint:** `/tasks/{task_id}`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Expected Status:** `200 OK`

#### TC-TASK-06: Delete Task as Member (RBAC Test)
- **Method:** `DELETE`
- **Endpoint:** `/tasks/{task_id}`
- **Headers:** `Authorization: Bearer <member_token>`
- **Expected Status:** `403 Forbidden`

---

### Module 4: Team Members API (`/api/v1/members`)

#### TC-MEM-01: List Members
- **Method:** `GET`
- **Endpoint:** `/members`
- **Headers:** `Authorization: Bearer <token>`
- **Expected Status:** `200 OK`
- **Security Check:** Verify that **`hashed_password` or `password` fields are NEVER included** in any user object.

#### TC-MEM-02: Invite Member with Zero-Knowledge Email (Security Test)
- **Method:** `POST`
- **Endpoint:** `/members/invite`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Payload:**
  ```json
  {
    "name": "Sarah Connor",
    "email": "sarah.connor@example.com",
    "designation": "Security Specialist",
    "joiningDate": "2026-11-01"
  }
  ```
- **Expected Status:** `201 Created`
- **Critical Security Check:**
  - Response body must NOT contain `temporaryPassword`.
  - Response shape: `{ "message": "Invitation sent successfully to sarah.connor@example.com", "member": { "id": "...", "name": "Sarah Connor", "email": "sarah.connor@example.com", "role": "member", "status": "active" } }`
  - In the database, `requires_password_change` must be `true`.

#### TC-MEM-03: Invite Duplicate Email
- **Method:** `POST`
- **Endpoint:** `/members/invite`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Payload:** Same email as an existing user.
- **Expected Status:** `409 Conflict`
- **Expected Body:** `{ "detail": "A user with this email already exists" }`

#### TC-MEM-04: Invite Member as Member (RBAC Test)
- **Method:** `POST`
- **Endpoint:** `/members/invite`
- **Headers:** `Authorization: Bearer <member_token>`
- **Expected Status:** `403 Forbidden`

#### TC-MEM-05: Update Member Profile (Self vs Admin)
- **Scenario A (Self):** Member updates own name and designation.
  - `PATCH /members/{self_id}` with `{ "name": "Abhishek G." }` -> `200 OK`.
- **Scenario B (Privilege Escalation):** Member tries to promote self to admin.
  - `PATCH /members/{self_id}` with `{ "role": "admin" }` -> `403 Forbidden` or `role` change ignored.
- **Scenario C (Admin):** Admin updates another user's role to `"admin"`.
  - `PATCH /members/{other_id}` with `{ "role": "admin" }` -> `200 OK`.

#### TC-MEM-06: Delete Member (Task Integrity Check)
- **Method:** `DELETE`
- **Endpoint:** `/members/{user_id}`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Expected Status:** `200 OK`
- **Post-condition Database Check:**
  - User record is deleted.
  - Any tasks previously assigned to this user have `assignee_id = NULL` (Tasks are NOT deleted).

---

### Module 5: Dashboard & Analytics APIs (`/api/v1/dashboard`, `/api/v1/analytics`)

#### TC-DASH-01: Admin Dashboard Data
- **Method:** `GET`
- **Endpoint:** `/dashboard/stats`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Expected Status:** `200 OK`
- **Expected Keys:**
  - `totalProjects` (integer)
  - `totalTasks` (integer)
  - `completedTasks` (integer)
  - `overdueTasks` (integer)
  - `recentlyCreatedTasks` (array of Task objects)
  - `recentActivity` (array of Activity items)

#### TC-DASH-02: Member Dashboard Data (Personal Queue)
- **Method:** `GET`
- **Endpoint:** `/dashboard/stats`
- **Headers:** `Authorization: Bearer <member_token>`
- **Expected Status:** `200 OK`
- **Expected Keys:**
  - `myAssignedTasks` (array)
  - `myOverdueTasks` (array)
  - `tasksDueSoon` (array)
  - `myProjects` (array)
  - `recentActivity` (array)

#### TC-ANAL-01: Analytics Overview (All Projects)
- **Method:** `GET`
- **Endpoint:** `/analytics/overview`
- **Headers:** `Authorization: Bearer <token>`
- **Expected Status:** `200 OK`
- **Expected Assertions:** Contains aggregated breakdown of status (`todo`, `in_progress`, `done`), workload by assignee, and completion trends.

#### TC-ANAL-02: Analytics Filtered by Project
- **Method:** `GET`
- **Endpoint:** `/analytics/overview?projectId={project_id}`
- **Expected Status:** `200 OK`
- **Expected Assertions:** Aggregations reflect only tasks from the specified `projectId`.

---

### Module 6: Redis Caching & Invalidation Testing

#### TC-CACHE-01: Redis Hit Verification
- **Steps:**
  1. Make `GET /dashboard/stats` (Request 1). Note response time (e.g. 80ms).
  2. Immediately make `GET /dashboard/stats` again (Request 2). Note response time (e.g. 4ms - served from Redis cache).
- **Expected Result:** Second request is served directly from Redis.

#### TC-CACHE-02: Cache Invalidation on Mutation
- **Steps:**
  1. Call `GET /dashboard/stats` (Cached).
  2. Call `POST /tasks` to add a new task.
  3. Call `GET /dashboard/stats`.
- **Expected Result:** `totalTasks` count increments by 1 immediately. The mutation successfully purged the stale Redis cache key.

---

## 3. Backend Error Code Standards (Centralized Handlers)

| HTTP Status | Error Case | Standard JSON Response |
|---|---|---|
| **400 Bad Request** | Business rule / date logic violation | `{ "detail": "dueDate must be greater than or equal to startDate" }` |
| **401 Unauthorized** | Missing, invalid, or expired JWT token | `{ "detail": "Could not validate credentials" }` |
| **403 Forbidden** | Role permission denied or unassigned access | `{ "detail": "Only administrators can perform this action" }` |
| **404 Not Found** | Entity does not exist | `{ "detail": "Project not found" }` |
| **409 Conflict** | Unique constraint violation (e.g. duplicate email) | `{ "detail": "A user with this email already exists" }` |
| **422 Unprocessable** | Pydantic schema validation failure | `{ "detail": [ { "loc": ["body", "email"], "msg": "value is not a valid email address" } ] }` |

---

## 4. Automation Testing Guide (`pytest`)

QA automation engineers can run the entire backend test suite using:

```bash
# Run all tests
pytest

# Run tests with detailed verbosity
pytest -v

# Run only authentication tests
pytest tests/test_auth.py -v

# Run with coverage report
pytest --cov=app --cov-report=html
```

---

## 5. QA Backend Sign-Off Criteria

To approve the backend API for frontend integration:
- [ ] 100% of the above test cases pass.
- [ ] All `401 Unauthorized` and `403 Forbidden` checks correctly reject unauthorized users.
- [ ] No unhandled `500 Internal Server Error` responses occur on any invalid inputs.
- [ ] Redis cache automatically invalidates on every task and project change.
- [ ] Zero passwords or password hashes appear in any response body or log file.
- [ ] The automated test suite (`pytest`) runs with 0 failures.
