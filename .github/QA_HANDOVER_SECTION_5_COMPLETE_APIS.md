## 5. Complete APIs with Parameters, Payloads & Scenarios

Base prefix: `/task_management/api/v1`  
All protected endpoints require the header: `Authorization: Bearer <JWT_ACCESS_TOKEN>`.  
All request and response JSON payloads use **`camelCase`** keys to match our frontend contracts.

### Pagination Standard for Collection Endpoints
To optimize PostgreSQL query performance and network transfer, collection endpoints (`/tasks`, `/projects`, `/projects/{id}/activities`) support optional pagination parameters:
- **Query Parameters:** `?page=1&pageSize=20` (defaults: `page=1`, `pageSize=20`, `maxPageSize=100`)
- **Dual Support Behavior:**
  - When called with pagination query params (`?page=...&pageSize=...`), the API returns the **Paginated Envelope** (`{ "items": [...], "pagination": { ... } }`).
  - When called without pagination query params (standard frontend list fetches), the API returns the direct array (`[...]`) for backwards compatibility with the Next.js React hooks.

---

### Route Group 1: Authentication (`/auth`) — 5 Endpoints

#### 1. `POST /task_management/api/v1/auth/login`
- **Purpose & Flow (2 Lines):** Validates email and bcrypt password hash against PostgreSQL and checks Redis rate limits. Issues a signed JWT access token and records the active session in Redis.
- **Headers:** `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
  ```json
  {
    "email": "sarah.connor@company.com",
    "password": "Password123!"
  }
  ```
- **Positive Scenario (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJyb2xlIjoiYWRtaW4ifQ.signature",
    "tokenType": "Bearer",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "sarah.connor@company.com",
      "name": "Sarah Connor",
      "role": "admin",
      "designation": "Lead QA Engineer",
      "requiresPasswordChange": false,
      "joiningDate": "2026-09-01"
    }
  }
  ```
- **Negative Scenarios:**
  - `401 Unauthorized`:
    ```json
    { "detail": "Invalid email or password." }
    ```
  - `422 Unprocessable Content`:
    ```json
    { "detail": [{ "loc": ["body", "email"], "msg": "value is not a valid email address", "type": "value_error" }] }
    ```

---

#### 2. `GET /task_management/api/v1/login` (Jinja2 Template Server-Side Route)
- **Purpose & Flow (2 Lines):** Renders a responsive server-side Jinja2 HTML sign-in card directly from FastAPI. Provides direct browser sign-in access and operational emergency login fallback.
- **Headers:** `Accept: text/html`
- **Path Parameters:** None
- **Query Parameters:** `error` (optional error banner string)
- **Request Body:** None
- **Positive Scenario (`200 OK`):**
  - Content-Type: `text/html; charset=utf-8`
  - Body: Renders full HTML document with `<form action="/task_management/api/v1/login" method="POST">` containing email, password inputs, and dynamic `{{ app_name }}` branding.
- **Negative Scenario (`500 Internal Server Error`):**
  - Returns fallback error page if template engine directory cannot be located.

---

#### 3. `POST /task_management/api/v1/auth/change-password`
- **Purpose & Flow (2 Lines):** Validates the current password, updates the bcrypt hash in PostgreSQL, and clears `requiresPasswordChange = false`. Invalids old sessions by blacklisting the previous token JTI in Redis.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Path / Query Parameters:** None
- **Request Body:**
  ```json
  {
    "email": "abhishek@gmail.com",
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongPassword456!",
    "confirmPassword": "NewStrongPassword456!"
  }
  ```
- **Positive Scenario (`200 OK`):**
  ```json
  {
    "message": "Password updated successfully",
    "user": {
      "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "email": "abhishek@gmail.com",
      "name": "Abhishek",
      "role": "member",
      "requiresPasswordChange": false
    }
  }
  ```
- **Negative Scenarios:**
  - `400 Bad Request` (New and confirm passwords mismatch):
    ```json
    { "detail": "New passwords do not match." }
    ```
  - `401 Unauthorized` (Incorrect current password):
    ```json
    { "detail": "Current password is incorrect." }
    ```

---

#### 4. `POST /task_management/api/v1/auth/refresh`
- **Purpose & Flow (2 Lines):** Validates the cryptographic signature and Redis session validity of an expiring refresh token. Issues a new short-lived JWT access token without forcing user re-authentication.
- **Headers:** `Content-Type: application/json`
- **Path / Query Parameters:** None
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh_token_payload.signature"
  }
  ```
- **Positive Scenario (`200 OK`):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_access_token.signature",
    "tokenType": "Bearer"
  }
  ```
- **Negative Scenario (`401 Unauthorized`):**
  ```json
  { "detail": "Refresh token expired or revoked." }
  ```

---

#### 5. `POST /task_management/api/v1/auth/logout`
- **Purpose & Flow (2 Lines):** Extracts the JWT token identifier from the authorization header and writes it to the Redis token blacklist with a matching TTL. Prevents any future replay attacks using the revoked token.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Request Body:** None
- **Positive Scenario (`200 OK`):**
  ```json
  { "message": "Logged out successfully" }
  ```
- **Negative Scenario (`401 Unauthorized`):**
  ```json
  { "detail": "Not authenticated." }
  ```

---

### Route Group 2: Projects (`/projects`) — 6 Endpoints

#### 6. `GET /task_management/api/v1/projects`
- **Purpose & Flow (2 Lines):** Retrieves projects filtered by role; Admins receive all workspace projects while Members receive only projects they belong to in `project_members`. Supports optional query filtering by status, category, and search text.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Query Parameters:** `status` (optional), `category` (optional), `search` (optional), `page` (default: 1), `pageSize` (default: 12)
- **Positive Scenario 1 — Default Array (`200 OK` for Frontend compatibility):**
  ```json
  [
    {
      "id": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
      "name": "Team Hub Migration",
      "description": "Migrating to FastAPI and PostgreSQL",
      "status": "planning",
      "category": "Engineering",
      "priority": "high",
      "startDate": "2026-11-01",
      "dueDate": "2026-12-01",
      "progress": 25,
      "memberIds": ["550e8400-e29b-41d4-a716-446655440000"],
      "createdAt": "2026-10-20T10:00:00Z"
    }
  ]
  ```
- **Positive Scenario 2 — Paginated Envelope (`200 OK` when `page` & `pageSize` provided):**
  ```json
  {
    "items": [
      {
        "id": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
        "name": "Team Hub Migration",
        "status": "planning",
        "category": "Engineering",
        "priority": "high",
        "startDate": "2026-11-01",
        "dueDate": "2026-12-01",
        "progress": 25,
        "memberIds": ["550e8400-e29b-41d4-a716-446655440000"],
        "createdAt": "2026-10-20T10:00:00Z"
      }
    ],
    "pagination": {
      "totalItems": 18,
      "page": 1,
      "pageSize": 12,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

#### 7. `POST /task_management/api/v1/projects`
- **Purpose & Flow (2 Lines):** Allows workspace Admins to initialize a new project with dates, priority, and category, and automatically binds assigned collaborators in `project_members`. Validates that `dueDate >= startDate`.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json` (Admin Role Required)
- **Request Body:**
  ```json
  {
    "name": "Team Hub Migration",
    "description": "Migrating to FastAPI and PostgreSQL",
    "status": "planning",
    "category": "Engineering",
    "priority": "high",
    "startDate": "2026-11-01",
    "dueDate": "2026-12-01",
    "memberIds": ["550e8400-e29b-41d4-a716-446655440000", "b733e169-49d4-4d66-b4ef-2460da7a3a30"]
  }
  ```
- **Positive Scenario (`201 Created`):**
  ```json
  {
    "id": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
    "name": "Team Hub Migration",
    "status": "planning",
    "category": "Engineering",
    "priority": "high",
    "startDate": "2026-11-01",
    "dueDate": "2026-12-01",
    "progress": 0,
    "createdAt": "2026-10-22T15:00:00Z"
  }
  ```
- **Negative Scenarios:**
  - `400 Bad Request` (`dueDate < startDate`):
    ```json
    { "detail": "dueDate cannot precede startDate." }
    ```
  - `403 Forbidden` (Member attempts project creation):
    ```json
    { "detail": "Admin privileges required." }
    ```

---

#### 8. `GET /task_management/api/v1/projects/{id}`
- **Purpose & Flow (2 Lines):** Retrieves single project details, assigned member IDs, and computed progress. Rejects requests from non-admin members not assigned to the project.
- **Path Parameters:** `id` (UUID of the project)
- **Positive Scenario (`200 OK`):**
  ```json
  {
    "id": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
    "name": "Team Hub Migration",
    "description": "Migrating to FastAPI and PostgreSQL",
    "status": "planning",
    "category": "Engineering",
    "priority": "high",
    "startDate": "2026-11-01",
    "dueDate": "2026-12-01",
    "progress": 25,
    "memberIds": ["550e8400-e29b-41d4-a716-446655440000"]
  }
  ```
- **Negative Scenario (`404 Not Found`):**
  ```json
  { "detail": "Project not found." }
  ```

---

#### 9. `PATCH /task_management/api/v1/projects/{id}`
- **Purpose & Flow (2 Lines):** Allows Admins to partially update project details, change dates, update member rosters, or archive/unarchive projects (`status = "archived"`). Preserves the previous status during archiving.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json` (Admin Only)
- **Path Parameters:** `id` (UUID)
- **Request Body:**
  ```json
  {
    "status": "active",
    "progress": 40
  }
  ```
- **Positive Scenario (`200 OK`):** Returns updated project object with `status: "active"` and `progress: 40`.
- **Negative Scenario (`404 Not Found`):** When project `id` does not exist.

---

#### 10. `DELETE /task_management/api/v1/projects/{id}`
- **Purpose & Flow (2 Lines):** Permanently removes a project from PostgreSQL, cascading the deletion to remove associated tasks, member join links, and activity logs. Purges related Redis cache keys.
- **Headers:** `Authorization: Bearer <TOKEN>` (Admin Only)
- **Path Parameters:** `id` (UUID)
- **Positive Scenario (`204 No Content`):** Empty body.
- **Negative Scenario (`403 Forbidden`):** If non-admin attempts deletion.

---

#### 11. `GET /task_management/api/v1/projects/{id}/activities`
- **Purpose & Flow (2 Lines):** Queries the `project_activities` table for the specified project and returns audit records ordered by `createdAt DESC`. Used directly by the project activity sidebar on the frontend board.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Path Parameters:** `id` (UUID)
- **Positive Scenario (`200 OK`):**
  ```json
  [
    {
      "id": "e2a44130-9b43-4ce4-893a-86c07a38755b",
      "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
      "taskId": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "taskTitle": "Configure Redis connection pool",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "userName": "Sarah Connor",
      "fromStatus": "todo",
      "toStatus": "in_progress",
      "createdAt": "2026-10-22T14:30:00Z"
    }
  ]
  ```

---

### Route Group 3: Tasks (`/tasks`) — 5 Endpoints

#### 12. `GET /task_management/api/v1/tasks`
- **Purpose & Flow (2 Lines):** Retrieves tasks filtered by query parameters with SQL index optimization. Allows filtering by project ID, status column (`backlog`, `todo`, `in_progress`, `done`), assignee, or priority.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Query Parameters:** `projectId` (optional), `status`, `assigneeId`, `priority`, `page` (default: 1), `pageSize` (default: 20)
- **Positive Scenario 1 — Default Array (`200 OK` for Frontend compatibility):**
  ```json
  [
    {
      "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
      "title": "Configure Redis connection pool",
      "description": "Set up shared Redis connection pool and health checks",
      "priority": "high",
      "status": "todo",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-15",
      "tags": ["backend", "redis"],
      "createdAt": "2026-10-22T13:00:00Z",
      "updatedAt": "2026-10-22T13:00:00Z"
    }
  ]
  ```
- **Positive Scenario 2 — Paginated Envelope (`200 OK` when `page` & `pageSize` provided):**
  ```json
  {
    "items": [
      {
        "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
        "title": "Configure Redis connection pool",
        "priority": "high",
        "status": "todo",
        "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "dueDate": "2026-11-15",
        "tags": ["backend", "redis"],
        "createdAt": "2026-10-22T13:00:00Z",
        "updatedAt": "2026-10-22T13:00:00Z"
      }
    ],
    "pagination": {
      "totalItems": 48,
      "page": 1,
      "pageSize": 20,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

#### 13. `POST /task_management/api/v1/tasks`
- **Purpose & Flow (2 Lines):** Creates a new task inside a project and validates that the designated `assigneeId` is an assigned collaborator of that project. Automatically invalidates the Redis dashboard statistics cache.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
    "title": "Configure Redis connection pool",
    "description": "Set up shared Redis connection pool and health checks",
    "priority": "high",
    "status": "todo",
    "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    "dueDate": "2026-11-15",
    "tags": ["backend", "redis"]
  }
  ```
- **Positive Scenario (`201 Created`):** Returns the full created task object with generated `id` and timestamps.
- **Negative Scenarios:**
  - `400 Bad Request` (Assignee not in project):
    ```json
    { "detail": "Assignee must be an active member of this project." }
    ```
  - `404 Not Found` (Non-existent `projectId`):
    ```json
    { "detail": "Parent project not found." }
    ```

---

#### 14. `GET /task_management/api/v1/tasks/{id}`
- **Purpose & Flow (2 Lines):** Retrieves a single task's full specifications, assigned collaborator info, and tags. Used when clicking a task card on the Kanban board to open the detail/edit modal.
- **Path Parameters:** `id` (UUID of the task)
- **Positive Scenario (`200 OK`):** Returns task object.
- **Negative Scenario (`404 Not Found`):**
  ```json
  { "detail": "Task not found." }
  ```

---

#### 15. `PATCH /task_management/api/v1/tasks/{id}`
- **Purpose & Flow (2 Lines):** Updates task fields; when status changes (e.g., dragged to *In Progress*), it inserts a transition record into `project_activities` and invalidates the Redis dashboard cache. Supports partial updates for title, description, priority, and tags.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Path Parameters:** `id` (UUID)
- **Request Body (Status Drag Move):**
  ```json
  {
    "status": "in_progress"
  }
  ```
- **Positive Scenario (`200 OK`):** Returns modified task with updated `status` and `updatedAt`.
- **Negative Scenario (`400 Bad Request`):** Invalid status value provided.

---

#### 16. `DELETE /task_management/api/v1/tasks/{id}`
- **Purpose & Flow (2 Lines):** Deletes a task from PostgreSQL and cascades to remove its activity log history. Only Admins are authorized to permanently purge tasks.
- **Headers:** `Authorization: Bearer <TOKEN>` (Admin Only)
- **Path Parameters:** `id` (UUID)
- **Positive Scenario (`204 No Content`):** Empty body.
- **Negative Scenario (`403 Forbidden`):** If non-admin attempts task deletion.

---

### Route Group 4: Members (`/members`) — 4 Endpoints

#### 17. `GET /task_management/api/v1/members`
- **Purpose & Flow (2 Lines):** Retrieves all registered workspace team members with roles, designations, and joining dates. Excludes sensitive password hash columns from serialization.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Positive Scenario (`200 OK`):**
  ```json
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sarah Connor",
      "email": "sarah.connor@company.com",
      "role": "admin",
      "designation": "Lead QA Engineer",
      "joiningDate": "2026-09-01",
      "status": "active",
      "requiresPasswordChange": false
    }
  ]
  ```

---

#### 18. `POST /task_management/api/v1/members/invite`
- **Purpose & Flow (2 Lines):** Generates a 12-character secure temporary password, hashes it into PostgreSQL with `requiresPasswordChange = true`, and fires an async background SMTP email via `aiosmtplib`. The temporary password is never exposed to the Admin or API response.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json` (Admin Only)
- **Request Body:**
  ```json
  {
    "name": "Alex Mercer",
    "email": "alex.mercer@company.com",
    "designation": "Backend Engineer",
    "joiningDate": "2026-11-01"
  }
  ```
- **Positive Scenario (`201 Created`):**
  ```json
  {
    "message": "Invitation email sent to alex.mercer@company.com",
    "member": {
      "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "email": "alex.mercer@company.com",
      "name": "Alex Mercer",
      "role": "member",
      "designation": "Backend Engineer",
      "joiningDate": "2026-11-01",
      "requiresPasswordChange": true
    }
  }
  ```
- **Negative Scenarios:**
  - `400 Bad Request` / `409 Conflict` (Duplicate email):
    ```json
    { "detail": "A user with this email already exists." }
    ```
  - `403 Forbidden` (Non-admin member attempts invitation):
    ```json
    { "detail": "Admin privileges required." }
    ```

---

#### 19. `PATCH /task_management/api/v1/members/{id}`
- **Purpose & Flow (2 Lines):** Updates user profile information in PostgreSQL. Admins can update designations and promote/demote roles (`role`), while standard members can only update their own display name and designation.
- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Path Parameters:** `id` (UUID of the user)
- **Request Body:**
  ```json
  {
    "name": "Alex Mercer",
    "designation": "Senior Backend Engineer"
  }
  ```
- **Positive Scenario (`200 OK`):** Returns updated user profile object.
- **Negative Scenario (`403 Forbidden`):** Standard member attempting to change someone else's profile or change their own `role`.

---

#### 20. `DELETE /task_management/api/v1/members/{id}`
- **Purpose & Flow (2 Lines):** Removes a member from the workspace, cascades to delete their `project_members` memberships, and sets `assignee_id = NULL` on their assigned tasks. Revokes the user's active session in Redis.
- **Headers:** `Authorization: Bearer <TOKEN>` (Admin Only)
- **Path Parameters:** `id` (UUID)
- **Positive Scenario (`204 No Content`):** Empty body.
- **Negative Scenario (`400 Bad Request`):** Attempting to delete the last remaining workspace Admin.

---

### Route Group 5: Dashboard & Analytics — 2 Endpoints

#### 21. `GET /task_management/api/v1/dashboard/stats`
- **Purpose & Flow (2 Lines):** Serves role-tailored dashboard metrics (Admin receives workspace-wide project/task KPIs; Member receives personalized task queues and overdue counts). Caches results in Redis with a 60-second TTL.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Path / Query Parameters:** None
- **Positive Scenario — Admin Role (`200 OK`):**
  ```json
  {
    "totalProjects": 8,
    "totalTasks": 24,
    "completedTasks": 12,
    "overdueTasks": 2,
    "recentlyCreatedTasks": []
  }
  ```
- **Positive Scenario — Member Role (`200 OK`):**
  ```json
  {
    "myAssignedTasks": [],
    "myOverdueTasks": [],
    "tasksDueSoon": [],
    "myProjects": []
  }
  ```

---

#### 22. `GET /task_management/api/v1/analytics/data`
- **Purpose & Flow (2 Lines):** Aggregates tasks by status for Kanban pie charts, task distribution by assignee for bar charts, and 7-day velocity metrics for line charts. Cached in Redis for 300 seconds to minimize complex database group-by calculations.
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Query Parameters:** `projectId` (optional filter for single project analytics)
- **Positive Scenario (`200 OK`):**
  ```json
  {
    "statusDistribution": [
      { "name": "Backlog", "value": 4 },
      { "name": "To Do", "value": 8 },
      { "name": "In Progress", "value": 6 },
      { "name": "Done", "value": 6 }
    ],
    "tasksByAssignee": [
      { "assignee": "Alex Mercer", "count": 7 },
      { "assignee": "Sarah Connor", "count": 5 }
    ],
    "completionTrends": [
      { "date": "2026-10-16", "completed": 2 },
      { "date": "2026-10-17", "completed": 3 }
    ]
  }
  ```

---

### Route Group 6: Health & Operational Check — 1 Endpoint

#### 23. `GET /task_management/api/v1/health`
- **Purpose & Flow (2 Lines):** Verifies active database connectivity via `SELECT 1` in PostgreSQL and performs a `PING` command on Redis. Used by container orchestration (Docker/Kubernetes) and QA health monitoring.
- **Headers:** None (Public)
- **Path / Query Parameters:** None
- **Positive Scenario (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-22T15:00:00Z",
    "services": {
      "database": "connected",
      "redis": "connected"
    }
  }
  ```
- **Negative Scenario (`503 Service Unavailable`):** Returned if either PostgreSQL or Redis cannot be reached.
