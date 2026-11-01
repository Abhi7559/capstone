# Team Hub — Backend API Contract & QA Specification

**Project:** Team Hub  
**Document Type:** API Standards, Backend Requirements & QA Verification Specification  
**Prepared By:** Backend & QA Engineering Team  
**Status:** Approved — Production Implementation Contract  
**Version:** 2.0  

---

## 1. Describe What the Project Is

Team Hub is an enterprise web-based workspace and task management platform that helps teams coordinate projects, assign tasks, track progress through Kanban boards, and monitor productivity metrics in one place. The backend is built with FastAPI, PostgreSQL 16, and Redis 7 to deliver high-performance APIs, persistent relational storage, and real-time dashboard caching.

### System Overview and Core Workflows

1. **Project Management:** Admins create projects, set priorities, categories, and deadlines, assign team members, and define custom Kanban workflow stages.
2. **Task Management & Kanban Board:** Members manage tasks across standard and custom Kanban stages (Backlog, To Do, In Progress, Code Review, Completed). Task transitions enforce workflow business rules and automatically log activity records.
3. **Dynamic Kanban Columns:** Projects support customized workflow columns (up to 8 columns per project) with automated task migration to the Backlog upon column deletion.
4. **Activity Audit Trail:** Task status transitions and updates are automatically recorded in `project_activities` to provide an immutable event log.
5. **Member Onboarding:** Admins invite new members via email. The backend renders branded invitation emails using Jinja2 and schedules delivery asynchronously via FastAPI `BackgroundTasks`. First-time users are flagged with `requiresPasswordChange = true`.
6. **Dashboard & Analytics:** Redis caches role-tailored dashboard metrics (60s TTL) and Recharts-formatted analytics datasets (300s TTL). Automatic cache invalidation ensures metrics refresh whenever tasks or projects are modified.
7. **HTMX Server-Side Rendering:** Server-rendered HTML dashboard components allow lightweight clients to view real-time metrics with automatic 30-second polling without executing client-side JavaScript frameworks.

### Role-Based Access Control (RBAC)

**Admin (`admin`)**
- Invite members and update user designations, statuses, and roles.
- Create, update, archive, and delete projects.
- Configure and reorder custom Kanban columns for projects.
- View all workspace projects, tasks, activities, and aggregated analytics.
- Create, reassign, update, and delete tasks.

**Member (`member`)**
- Access only projects where they are explicitly assigned in `project_members`.
- Create and update tasks within permitted projects.
- Move tasks across Kanban stages according to transition rules.
- View and update their personal profile.
- View their personalized dashboard containing assigned tasks, upcoming deadlines, and overdue tasks.

---

## 2. PostgreSQL Schema and Tables

Team Hub uses 5 PostgreSQL tables to store user accounts, projects, project memberships, tasks, and activity history. Primary keys, foreign keys, unique constraints, and validation rules help maintain data integrity.

### Table 1: `users`

Stores user information, login credentials, roles, and onboarding status.

| Column | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID | Primary key, auto-generated |
| `email` | VARCHAR(255) | Required, unique, indexed case-insensitively |
| `hashed_password` | VARCHAR(255) | Required; stores the password hash |
| `name` | VARCHAR(150) | Required; user's display name |
| `role` | VARCHAR(20) | Required; `admin` or `member` |
| `status` | VARCHAR(20) | Required; `active`, `invited`, or `suspended`; default `active` |
| `designation` | VARCHAR(150) | Optional; default `Contributor` |
| `requires_password_change` | BOOLEAN | Required; default `false` |
| `joining_date` | DATE | Required; default `CURRENT_DATE` |
| `created_at` | TIMESTAMPTZ | Defaults to the current timestamp |
| `updated_at` | TIMESTAMPTZ | Updated when the record changes |

### Table 2: `projects`

Stores project details, deadlines, priorities, progress, and dynamic Kanban workflow columns.

| Column | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID | Primary key, auto-generated |
| `name` | VARCHAR(255) | Required, indexed |
| `description` | TEXT | Optional; project details |
| `status` | VARCHAR(50) | Required; `planning`, `active`, `completed`, `on-hold`, or `archived` |
| `previous_status` | VARCHAR(50) | Optional; previous status before archiving |
| `category` | VARCHAR(100) | Required; default `General` |
| `priority` | VARCHAR(30) | Required; `low`, `medium`, `high`, or `critical`; default `medium` |
| `start_date` | DATE | Required; planned project start |
| `due_date` | DATE | Required; must be on or after `start_date` |
| `progress` | INTEGER | Required; default `0`, range `0–100` |
| `kanban_columns` | JSONB | Required; stores dynamic columns array; default standard 3-column workflow |
| `is_deleted` | BOOLEAN | Required; default `false` (supports soft-deletion) |
| `created_by` | UUID | Foreign key to `users.id`; `ON DELETE SET NULL` |
| `created_at` | TIMESTAMPTZ | Defaults to the current timestamp |
| `updated_at` | TIMESTAMPTZ | Updated when the record changes |

### Table 3: `project_members`

Connects users and projects through a many-to-many relationship. It determines which projects each member can access.

| Column | Data Type | Constraints / Description |
| --- | --- | --- |
| `project_id` | UUID | Primary key component; foreign key to `projects.id`; `ON DELETE CASCADE` |
| `user_id` | UUID | Primary key component; foreign key to `users.id`; `ON DELETE CASCADE` |
| `assigned_at` | TIMESTAMPTZ | Defaults to the current timestamp |

**Constraint:** The combination of `project_id` and `user_id` must be unique.

### Table 4: `tasks`

Stores tasks created within projects and tracks their Kanban status, assignee, priority, and deadline.

| Column | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID | Primary key, auto-generated |
| `project_id` | UUID | Required; foreign key to `projects.id`; `ON DELETE CASCADE` |
| `assignee_id` | UUID | Optional; foreign key to `users.id`; `ON DELETE SET NULL` |
| `title` | VARCHAR(255) | Required; task title |
| `description` | TEXT | Optional; task details |
| `status` | VARCHAR(50) | Required; `backlog`, `todo`, `in_progress`, `done`, or custom column slug; default `todo` |
| `priority` | VARCHAR(30) | Required; `low`, `medium`, `high`, or `critical`; default `medium` |
| `due_date` | DATE | Required; task deadline |
| `tags` | JSONB | Required; defaults to an empty JSON array `[]` |
| `is_deleted` | BOOLEAN | Required; default `false` (supports soft-deletion) |
| `created_at` | TIMESTAMPTZ | Defaults to the current timestamp |
| `updated_at` | TIMESTAMPTZ | Updated when the record changes |

### Table 5: `project_activities`

Stores task status changes and audit events within individual projects.

| Column | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | UUID | Primary key, auto-generated |
| `project_id` | UUID | Required; foreign key to `projects.id`; `ON DELETE CASCADE` |
| `task_id` | UUID | Required; foreign key to `tasks.id`; `ON DELETE CASCADE` |
| `task_title` | VARCHAR(255) | Required; task title snapshot |
| `user_id` | UUID | Optional; foreign key to `users.id`; `ON DELETE SET NULL` |
| `user_name` | VARCHAR(150) | Required; actor name snapshot |
| `from_status` | VARCHAR(50) | Required; status before the change |
| `to_status` | VARCHAR(50) | Required; status after the change |
| `created_at` | TIMESTAMPTZ | Defaults to the current timestamp |

---

## 3. External Services — PostgreSQL & Redis

### PostgreSQL Engine Configuration
- **Connection Engine:** SQLAlchemy 2.0 `AsyncEngine` utilizing `asyncpg`.
- **Pool Sizing:** `pool_size = 10`, `max_overflow = 20`, `pool_pre_ping = True`.
- **Driver Normalization:** The configuration layer automatically normalizes connection strings starting with `postgres://` or `postgresql://` to `postgresql+asyncpg://` for seamless cloud deployment.
- **Indexes:**
  - `idx_users_email` — Fast unique lookup during authentication.
  - `idx_tasks_project_status` — Fast filtering for Kanban board rendering.
  - `idx_tasks_assignee_id` — Fast workload queries for dashboard and member assignments.
  - `idx_project_activities_created` — Chronological retrieval of project history.

### Redis Caching & Invalidation
- **Token Blacklist:** Logout operations blacklist access tokens at `blacklist:{token}` with TTL matching the token's remaining validity.
- **KPI Metrics Caching:**
  - `kpi:dashboard:admin` (TTL: 60s)
  - `kpi:dashboard:member:{user_id}` (TTL: 60s)
  - `kpi:analytics:all` (TTL: 300s)
  - `kpi:analytics:{project_id}` (TTL: 300s)
- **Automatic Fallback:** All Redis calls fail gracefully; if Redis is down or unconfigured, queries transparently execute against PostgreSQL without raising application errors.

---

## 4. Complete API Reference

### Live Environment & Connection Parameters

- **Base URL (Verified Active):** `https://teamhub-backend-p5a1.onrender.com/task_management/api/v1`
- **Alternative Mirror:** `https://workstream-backend-1rr8.onrender.com/task_management/api/v1`
- **Default Admin Credentials:**
  - Email: `admin@teamboard.com` (or `admin@teamhub.com`)
  - Password: `Admin@123`
- **PostgreSQL 16 Connection (Render Cloud):**
  - **External Host:** `dpg-dbi6hb6tlv9c7390ga9g-a.oregon-postgres.render.com` (Port: `5432`)
  - **Internal Host:** `dpg-dbi6hb6tlv9c7390ga9g-a`
  - **Database:** `teamhub_vj36`
  - **User:** `teamhub_vj36_user`
  - **Password:** `bvBLm7q49dlLVmOZdXQ7edLUpsOONPOB`
  - **SSL Mode:** `require`

**Standard Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <JWT_ACCESS_TOKEN>` (on protected routes)
**Naming Convention:** JSON request and response payloads strictly enforce `camelCase`.

---

### Router 1: Authentication (`/auth`) — 6 Endpoints

#### 1. `POST /task_management/api/v1/auth/login`

- **Purpose:** Authenticates user credentials using email and bcrypt-hashed password, issues a short-lived JWT access token (15 minutes) and a long-lived refresh token (7 days), and returns the authenticated user's public profile and onboarding status.
- **Scoping & RBAC:**
    - **Access:** Public (No authorization header required).
    - **Status Check:** Rejects suspended or inactive accounts with `403 Forbidden`.
- **Headers:** `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "email": "admin@teamboard.com",
      "password": "Admin@123"
    }
    ```
- **Positive Response Scenario A (When Called by Active User — Standard Login):**
    - HTTP 200 OK — Issues tokens and returns profile with `requiresPasswordChange: false`:
    
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImFkbWluQHRlYW1ib2FyZC5jb20iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTM0NTYwMDB9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NDAwMDAwMH0...",
      "tokenType": "Bearer",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "admin@teamboard.com",
        "name": "System Admin",
        "role": "admin",
        "designation": "System Administrator",
        "status": "active",
        "requiresPasswordChange": false,
        "joiningDate": "2026-09-01"
      }
    }
    ```

- **Positive Response Scenario B (When Called by Invited Member — First-Time Onboarding):**
    - HTTP 200 OK — Returns `requiresPasswordChange: true` prompting the client to display the mandatory password reset screen:
    
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "user": {
        "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "email": "alex.mercer@company.com",
        "name": "Alex Mercer",
        "role": "member",
        "designation": "Senior Backend Engineer",
        "status": "active",
        "requiresPasswordChange": true,
        "joiningDate": "2026-11-01"
      }
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Invalid email or password." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "User account is suspended or inactive." }
        ```
    - **HTTP 422 Unprocessable Content** | **Exception:** `RequestValidationError`
        ```json
        {
          "detail": [
            {
              "loc": ["body", "email"],
              "msg": "value is not a valid email address",
              "type": "value_error"
            }
          ]
        }
        ```

---

#### 2. `PATCH /task_management/api/v1/auth/change-password`

- **Purpose:** Rotates an authenticated user's password. Verifies the existing `currentPassword`, validates the `newPassword` complexity and confirmation match, updates the bcrypt password hash in PostgreSQL, and clears the mandatory rotation flag (`requiresPasswordChange = false`).
- **Scoping & RBAC:** Protected. Requires valid access token. Accessible to all roles (`admin` or `member`), including users whose `requiresPasswordChange` is currently `true`.
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "currentPassword": "TempPassword123!",
      "newPassword": "NewSecurePassword456!",
      "confirmPassword": "NewSecurePassword456!"
    }
    ```
- **Positive Response Scenario A (Password Successfully Changed):**
    - HTTP 200 OK — Password rotated and onboarding flag cleared:
    
    ```json
    {
      "message": "Password updated successfully",
      "user": {
        "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "email": "alex.mercer@company.com",
        "name": "Alex Mercer",
        "role": "member",
        "requiresPasswordChange": false
      }
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "New password cannot be the same as current password." }
        ```
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "New password and confirmation password do not match." }
        ```
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Incorrect current password." }
        ```
    - **HTTP 422 Unprocessable Content** | **Exception:** `RequestValidationError`
        ```json
        {
          "detail": [
            {
              "loc": ["body", "newPassword"],
              "msg": "String should have at least 8 characters",
              "type": "string_too_short"
            }
          ]
        }
        ```

---

#### 3. `POST /task_management/api/v1/auth/signup`

- **Purpose:** Activates an invited user's account and sets their initial permanent password using the signed cryptographic invitation token delivered in their onboarding welcome email.
- **Scoping & RBAC:** Public. Authentication is cryptographically verified via the invitation token payload and expiration.
- **Headers:** `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "email": "alex.mercer@company.com",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNzMzZTE2OS00OWQ0LTRkNjYtYjRlZi0yNDYwZGE3YTNhMzAiLCJlbWFpbCI6ImFsZXgubWVyY2VyQGNvbXBhbnkuY29tIiwiZXhwIjoxNzkzNjI4ODAwfQ...",
      "newPassword": "SecurePassword123!",
      "confirmPassword": "SecurePassword123!"
    }
    ```
- **Positive Response Scenario A (Successful Member Activation):**
    - HTTP 200 OK — Account activated and cleared for workspace login:
    
    ```json
    {
      "message": "Account activated and password set successfully",
      "user": {
        "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "email": "alex.mercer@company.com",
        "name": "Alex Mercer",
        "role": "member",
        "requiresPasswordChange": false
      }
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "New password and confirmation password do not match." }
        ```
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Invalid or expired invitation token." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Member with identifier 'alex.mercer@company.com' not found." }
        ```

---

#### 4. `POST /task_management/api/v1/auth/refresh`

- **Purpose:** Exchanges a valid, unrevoked JWT refresh token for a newly signed 15-minute access token, enabling seamless persistent sessions without prompt logins.
- **Scoping & RBAC:** Public. Validated by refresh token signature and Redis token blacklist status.
- **Headers:** `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NDAwMDAwMH0..."
    }
    ```
- **Positive Response Scenario A (Access Token Successfully Refreshed):**
    - HTTP 200 OK — New access token generated:
    
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImFkbWluQHRlYW1ib2FyZC5jb20iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTM0NTY5MDB9...",
      "tokenType": "Bearer"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Refresh token is invalid, expired, or revoked." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "User account associated with this token no longer exists." }
        ```

---

#### 5. `POST /task_management/api/v1/auth/logout`

- **Purpose:** Revokes the current session by extracting the active JWT Bearer token and recording it into the Redis blacklist (`blacklist:<token>`) for its remaining TTL duration, preventing replay attacks.
- **Scoping & RBAC:** Protected. Requires valid access token. Allowed for both `admin` and `member`.
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Session Revoked):**
    - HTTP 200 OK:
    
    ```json
    {
      "message": "Logged out successfully"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Could not validate credentials." }
        ```

---

#### 6. `GET /task_management/api/v1/auth/me`

- **Purpose:** Retrieves the public profile details, role, status, designation, and deterministic DiceBear avatar URL of the authenticated user identified by the incoming Bearer token.
- **Scoping & RBAC:** Protected. Accessible to any authenticated user (`admin` or `member`).
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (When Called by Admin):**
    - HTTP 200 OK:
    
    ```json
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@teamboard.com",
      "name": "System Admin",
      "role": "admin",
      "status": "active",
      "designation": "System Administrator",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=System%20Admin",
      "createdAt": "2026-09-01T00:00:00Z"
    }
    ```

- **Positive Response Scenario B (When Called by Member):**
    - HTTP 200 OK:
    
    ```json
    {
      "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "email": "alex.mercer@company.com",
      "name": "Alex Mercer",
      "role": "member",
      "status": "active",
      "designation": "Senior Backend Engineer",
      "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex%20Mercer",
      "createdAt": "2026-10-30T06:00:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Could not validate credentials." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Password change required before accessing this resource." }
        ```

---

### Router 2: Projects & Dynamic Kanban Columns (`/projects`) — 10 Endpoints

#### 1. `GET /task_management/api/v1/projects`

- **Purpose:** Retrieves projects visible to the authenticated user. Supports dual-mode response formatting: returns standard paginated envelopes when pagination parameters are provided, or flat lists for dashboard integration. Supports filtering by status, category, and text search.
- **Scoping & RBAC:**
    - **When accessed by Admin:** Returns all projects across the entire organization workspace.
    - **When accessed by Member:** Automatically scopes the query to projects where the authenticated user is an assigned member in `project_members`.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:** None
- **Query Parameters:**
    - `page` (`integer`, optional, $\ge 1$) — Page number (1-based index).
    - `pageSize` (`integer`, optional, $1 \le pageSize \le 100$, default: `12`) — Number of projects per page.
    - `status` (`string`, optional) — Filter by project status (`planning`, `active`, `paused`, `completed`, `archived`).
    - `category` (`string`, optional) — Filter by category (`Engineering`, `Marketing`, `Design`, `Operations`).
    - `search` (`string`, optional) — Case-insensitive search on project `name`.
- **Request Body:** None
- **Positive Response Scenario A (When Called with Pagination Parameters — `?page=1&pageSize=2`):**
    - HTTP 200 OK — Standard paginated envelope:
    
    ```json
    {
      "items": [
        {
          "id": "98084b00-fca4-4191-8a33-aa2c51596b4b",
          "name": "Live E2E Workspace",
          "description": "Integration verification project for end-to-end testing.",
          "status": "active",
          "category": "Engineering",
          "priority": "high",
          "startDate": "2026-11-01",
          "dueDate": "2026-11-30",
          "progress": 40,
          "memberIds": [
            "550e8400-e29b-41d4-a716-446655440000",
            "b733e169-49d4-4d66-b4ef-2460da7a3a30"
          ],
          "kanbanColumns": [
            { "id": "backlog", "label": "BACKLOG", "status": "backlog", "color": "bg-slate-50 text-slate-700" },
            { "id": "todo", "label": "TO DO", "status": "todo", "color": "bg-slate-100 text-slate-800" },
            { "id": "in_progress", "label": "IN PROGRESS", "status": "in_progress", "color": "bg-blue-50 text-blue-800" },
            { "id": "done", "label": "DONE", "status": "done", "color": "bg-emerald-50 text-emerald-800" }
          ],
          "createdAt": "2026-10-30T06:00:00Z"
        }
      ],
      "pagination": {
        "totalItems": 1,
        "page": 1,
        "pageSize": 2,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false
      }
    }
    ```

- **Positive Response Scenario B (When Called without Pagination — Flat List Mode):**
    - HTTP 200 OK — Array of project objects:
    
    ```json
    [
      {
        "id": "98084b00-fca4-4191-8a33-aa2c51596b4b",
        "name": "Live E2E Workspace",
        "description": "Integration verification project for end-to-end testing.",
        "status": "active",
        "category": "Engineering",
        "priority": "high",
        "startDate": "2026-11-01",
        "dueDate": "2026-11-30",
        "progress": 40,
        "memberIds": [
          "550e8400-e29b-41d4-a716-446655440000"
        ],
        "kanbanColumns": [],
        "createdAt": "2026-10-30T06:00:00Z"
      }
    ]
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Could not validate credentials." }
        ```
    - **HTTP 422 Unprocessable Content** | **Exception:** `RequestValidationError`
        ```json
        {
          "detail": [
            {
              "loc": ["query", "page"],
              "msg": "Input should be greater than or equal to 1",
              "type": "greater_than_equal"
            }
          ]
        }
        ```

---

#### 2. `POST /task_management/api/v1/projects`

- **Purpose:** Creates a new project in the workspace, assigns initial team members, verifies dates, and bootstraps the default Kanban columns (`Backlog`, `To Do`, `In Progress`, `Done`).
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "name": "Cloud Infrastructure Migration",
      "description": "Migrate on-premise compute nodes to containerized microservices on GCP.",
      "status": "planning",
      "category": "Engineering",
      "priority": "high",
      "startDate": "2026-11-01",
      "dueDate": "2026-12-15",
      "memberIds": [
        "550e8400-e29b-41d4-a716-446655440000",
        "b733e169-49d4-4d66-b4ef-2460da7a3a30"
      ]
    }
    ```
- **Positive Response Scenario A (Project Created):**
    - HTTP 201 Created — Project record initialized with default columns:
    
    ```json
    {
      "id": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "name": "Cloud Infrastructure Migration",
      "description": "Migrate on-premise compute nodes to containerized microservices on GCP.",
      "status": "planning",
      "category": "Engineering",
      "priority": "high",
      "startDate": "2026-11-01",
      "dueDate": "2026-12-15",
      "progress": 0,
      "memberIds": [
        "550e8400-e29b-41d4-a716-446655440000",
        "b733e169-49d4-4d66-b4ef-2460da7a3a30"
      ],
      "kanbanColumns": [
        { "id": "backlog", "label": "Backlog", "status": "backlog", "color": "bg-slate-100 border-slate-300 text-slate-700" },
        { "id": "todo", "label": "To Do", "status": "todo", "color": "bg-indigo-50 border-indigo-200 text-indigo-800" },
        { "id": "in_progress", "label": "In Progress", "status": "in_progress", "color": "bg-blue-50 border-blue-200 text-blue-800" },
        { "id": "done", "label": "Done", "status": "done", "color": "bg-emerald-50 border-emerald-200 text-emerald-800" }
      ],
      "createdAt": "2026-10-30T10:00:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "Project due date (2026-10-01) cannot be earlier than start date (2026-11-01)." }
        ```
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "One or more assigned member IDs do not exist." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to create projects." }
        ```

---

#### 3. `GET /task_management/api/v1/projects/{id}`

- **Purpose:** Retrieves full details of a specific project, including its assigned member IDs and custom Kanban column layout.
- **Scoping & RBAC:**
    - **Admin:** Can view any project in the workspace.
    - **Member:** Permitted only if the member is assigned to the project.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Project Found):**
    - HTTP 200 OK:
    
    ```json
    {
      "id": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "name": "Cloud Infrastructure Migration",
      "description": "Migrate on-premise compute nodes to containerized microservices on GCP.",
      "status": "planning",
      "category": "Engineering",
      "priority": "high",
      "startDate": "2026-11-01",
      "dueDate": "2026-12-15",
      "progress": 0,
      "memberIds": [
        "550e8400-e29b-41d4-a716-446655440000",
        "b733e169-49d4-4d66-b4ef-2460da7a3a30"
      ],
      "kanbanColumns": [
        { "id": "backlog", "label": "Backlog", "status": "backlog", "color": "bg-slate-100 border-slate-300 text-slate-700" },
        { "id": "todo", "label": "To Do", "status": "todo", "color": "bg-indigo-50 border-indigo-200 text-indigo-800" },
        { "id": "in_progress", "label": "In Progress", "status": "in_progress", "color": "bg-blue-50 border-blue-200 text-blue-800" },
        { "id": "done", "label": "Done", "status": "done", "color": "bg-emerald-50 border-emerald-200 text-emerald-800" }
      ],
      "createdAt": "2026-10-30T10:00:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have permission to access this project." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found." }
        ```

---

#### 4. `PATCH /task_management/api/v1/projects/{id}`

- **Purpose:** Partially updates project metadata, status, progress percentage, member assignments, or dates. Automatically updates `updated_at` and invalidates cached analytics.
- **Scoping & RBAC:**
    - **Admin Only:** Only workspace administrators can modify project properties. Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "status": "active",
      "progress": 50,
      "priority": "urgent"
    }
    ```
- **Positive Response Scenario A (Project Updated):**
    - HTTP 200 OK — Returns updated project:
    
    ```json
    {
      "id": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "name": "Cloud Infrastructure Migration",
      "description": "Migrate on-premise compute nodes to containerized microservices on GCP.",
      "status": "active",
      "category": "Engineering",
      "priority": "urgent",
      "startDate": "2026-11-01",
      "dueDate": "2026-12-15",
      "progress": 50,
      "memberIds": [
        "550e8400-e29b-41d4-a716-446655440000",
        "b733e169-49d4-4d66-b4ef-2460da7a3a30"
      ],
      "kanbanColumns": [],
      "createdAt": "2026-10-30T10:00:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "Progress must be an integer between 0 and 100." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to update projects." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found." }
        ```

---

#### 5. `DELETE /task_management/api/v1/projects/{id}`

- **Purpose:** Deletes a project and cascades removal to all linked tasks, task assignments, project memberships, and activity audit trails.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Project Deleted):**
    - HTTP 200 OK:
    
    ```json
    {
      "success": true,
      "message": "Project deleted successfully."
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to delete projects." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found." }
        ```

---

#### 6. `GET /task_management/api/v1/projects/{id}/activities`

- **Purpose:** Returns the chronological audit activity feed for a project, tracking task creations, drag-and-drop Kanban status movements, and assignee changes.
- **Scoping & RBAC:**
    - **Admin:** Accessible for any project.
    - **Member:** Accessible only if assigned to the project.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Activity Feed Returned):**
    - HTTP 200 OK — List of activity items sorted descending by timestamp:
    
    ```json
    [
      {
        "id": "c54c1e74-b8b8-42b5-9248-7b8dcf96421a",
        "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
        "taskId": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
        "taskTitle": "Configure Cloud SQL Database",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "userName": "System Admin",
        "fromStatus": "in_progress",
        "toStatus": "done",
        "createdAt": "2026-10-30T10:30:00Z"
      }
    ]
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have access to view activities for this project." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found." }
        ```

---

#### 7. `GET /task_management/api/v1/projects/{id}/columns`

- **Purpose:** Retrieves the list of active Kanban columns configured for a project, including their unique slugs, display labels, visual colors, and relative display order.
- **Scoping & RBAC:**
    - Protected. Accessible to Admins and assigned project members.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Project Columns Retrieved):**
    - HTTP 200 OK:
    
    ```json
    [
      {
        "id": "backlog",
        "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
        "name": "Backlog",
        "slug": "backlog",
        "order": 0,
        "color": "bg-slate-100 border-slate-300 text-slate-700"
      },
      {
        "id": "todo",
        "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
        "name": "To Do",
        "slug": "todo",
        "order": 1,
        "color": "bg-indigo-50 border-indigo-200 text-indigo-800"
      },
      {
        "id": "in_progress",
        "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
        "name": "In Progress",
        "slug": "in_progress",
        "order": 2,
        "color": "bg-blue-50 border-blue-200 text-blue-800"
      },
      {
        "id": "done",
        "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
        "name": "Done",
        "slug": "done",
        "order": 3,
        "color": "bg-emerald-50 border-emerald-200 text-emerald-800"
      }
    ]
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have access to view columns for this project." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found." }
        ```

---

#### 8. `POST /task_management/api/v1/projects/{id}/columns`

- **Purpose:** Adds a custom Kanban column to an existing project. Automatically generates a unique URL-safe `slug` from the column name, appends it to the project column definitions, and assigns the next incremented order index.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Validation Rules:**
    - Maximum 8 columns per project. Exceeding this limit returns `400 Bad Request`.
    - Column names must be unique within the project. Duplicate names return `409 Conflict`.
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "name": "QA Testing",
      "color": "bg-purple-50 border-purple-200 text-purple-800"
    }
    ```
- **Positive Response Scenario A (Custom Column Created):**
    - HTTP 201 Created:
    
    ```json
    {
      "id": "qa_testing",
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "name": "QA Testing",
      "slug": "qa_testing",
      "order": 4,
      "color": "bg-purple-50 border-purple-200 text-purple-800"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "A project can have a maximum of 8 columns." }
        ```
    - **HTTP 409 Conflict** | **Exception:** `DuplicateEntityException`
        ```json
        { "detail": "A column with name 'QA Testing' already exists in this project." }
        ```

---

#### 9. `PUT /task_management/api/v1/projects/{id}/columns/reorder`

- **Purpose:** Persists the new horizontal display sequence of Kanban columns after a drag-and-drop reorder action by updating the `order` index of every listed column.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "columnIds": ["backlog", "todo", "qa_testing", "in_progress", "done"]
    }
    ```
- **Positive Response Scenario A (Columns Reordered):**
    - HTTP 200 OK — Returns columns sorted in new sequence:
    
    ```json
    [
      { "id": "backlog", "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f", "name": "Backlog", "slug": "backlog", "order": 0, "color": "bg-slate-100 border-slate-300 text-slate-700" },
      { "id": "todo", "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f", "name": "To Do", "slug": "todo", "order": 1, "color": "bg-indigo-50 border-indigo-200 text-indigo-800" },
      { "id": "qa_testing", "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f", "name": "QA Testing", "slug": "qa_testing", "order": 2, "color": "bg-purple-50 border-purple-200 text-purple-800" },
      { "id": "in_progress", "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f", "name": "In Progress", "slug": "in_progress", "order": 3, "color": "bg-blue-50 border-blue-200 text-blue-800" },
      { "id": "done", "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f", "name": "Done", "slug": "done", "order": 4, "color": "bg-emerald-50 border-emerald-200 text-emerald-800" }
    ]
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "Reorder list must contain all existing project column IDs." }
        ```

---

#### 10. `DELETE /task_management/api/v1/projects/{id}/columns/{column_id}`

- **Purpose:** Deletes a Kanban column from the project. Protects data integrity by safely migrating all active tasks situated in this column back to the `backlog` column before removing the column definition.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Project UUID identifier.
    - `column_id` (`string`, required) — The slug or ID of the column to delete (e.g. `qa_testing`).
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Column Deleted & Tasks Migrated):**
    - HTTP 204 No Content — Empty response body.
- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "Cannot delete the default 'backlog' column." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Column 'qa_testing' not found in project '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f'." }
        ```

---

### Router 3: Tasks (`/tasks`) — 6 Endpoints

#### 1. `GET /task_management/api/v1/tasks`

- **Purpose:** Retrieves tasks matching filter criteria. Operates in dual response modes: returns standard paginated envelopes when pagination parameters are provided, or flat lists for Kanban boards and list views. Supports filtering by project, workflow status, priority, assignee, due date, and categorization tags.
- **Scoping & RBAC:**
    - **When accessed by Admin:** Can query and view tasks across all projects and members.
    - **When accessed by Member:** Automatically scoped to tasks belonging to projects where the member is an assigned contributor.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:** None
- **Query Parameters:**
    - `page` (`integer`, optional, $\ge 1$) — Page number (1-based index).
    - `pageSize` (`integer`, optional, $1 \le pageSize \le 100$, default: `20`) — Tasks per page.
    - `projectId` (`UUID`, optional) — Scope tasks to a specific project.
    - `status` (`string`, optional) — Filter by Kanban column slug (`backlog`, `todo`, `in_progress`, `done`, or custom slugs).
    - `priority` (`string`, optional) — Filter by priority (`low`, `medium`, `high`, `urgent`).
    - `assigneeId` (`UUID`, optional) — Filter by assigned member UUID.
    - `dueDate` (`date`, optional, `YYYY-MM-DD`) — Filter by target due date.
    - `tag` (`string`, optional) — Filter tasks containing a specific tag (e.g. `frontend`, `backend`, `database`).
- **Request Body:** None
- **Positive Response Scenario A (When Called with Pagination — `?page=1&pageSize=1`):**
    - HTTP 200 OK — Standard paginated envelope:
    
    ```json
    {
      "items": [
        {
          "id": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
          "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
          "title": "Configure Cloud SQL Database",
          "description": "Provision PostgreSQL 16 instance and setup connection pooling.",
          "priority": "high",
          "status": "todo",
          "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
          "dueDate": "2026-11-05",
          "tags": ["gcp", "database"],
          "createdAt": "2026-10-30T06:35:26Z",
          "updatedAt": "2026-10-30T06:36:09Z"
        }
      ],
      "pagination": {
        "totalItems": 1,
        "page": 1,
        "pageSize": 1,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false
      }
    }
    ```

- **Positive Response Scenario B (When Called for Kanban Board — Flat List Mode):**
    - HTTP 200 OK — Array of task items:
    
    ```json
    [
      {
        "id": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
        "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
        "title": "Configure Cloud SQL Database",
        "description": "Provision PostgreSQL 16 instance and setup connection pooling.",
        "priority": "high",
        "status": "todo",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
        "dueDate": "2026-11-05",
        "tags": ["gcp", "database"],
        "createdAt": "2026-10-30T06:35:26Z",
        "updatedAt": "2026-10-30T06:36:09Z"
      }
    ]
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Could not validate credentials." }
        ```

---

#### 2. `POST /task_management/api/v1/tasks`

- **Purpose:** Creates a new task within a specified project. Enforces referential integrity by validating project existence and verifying that the assigned user (`assigneeId`) is an active member of that project. Automatically invalidates related dashboard caches in Redis.
- **Scoping & RBAC:**
    - **Admin:** Can create tasks in any project and assign any project member.
    - **Member:** Can create tasks only within projects where they are an assigned member.
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "title": "Implement Drag and Drop Kanban Transitions",
      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",
      "priority": "medium",
      "status": "todo",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-10",
      "tags": ["frontend", "kanban", "ux"]
    }
    ```
- **Positive Response Scenario A (Task Created):**
    - HTTP 201 Created:
    
    ```json
    {
      "id": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f",
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "title": "Implement Drag and Drop Kanban Transitions",
      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",
      "priority": "medium",
      "status": "todo",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-10",
      "tags": ["frontend", "kanban", "ux"],
      "createdAt": "2026-10-30T10:45:00Z",
      "updatedAt": "2026-10-30T10:45:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "The assigned user is not a member of this project." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have permission to create tasks in this project." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found." }
        ```

---

#### 3. `GET /task_management/api/v1/tasks/{id}`

- **Purpose:** Retrieves full details of an individual task by its unique identifier.
- **Scoping & RBAC:**
    - **Admin:** Can view any task in the workspace.
    - **Member:** Can only view the task if they are assigned to the project it belongs to.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Task UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Task Found):**
    - HTTP 200 OK:
    
    ```json
    {
      "id": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f",
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "title": "Implement Drag and Drop Kanban Transitions",
      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",
      "priority": "medium",
      "status": "todo",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-10",
      "tags": ["frontend", "kanban", "ux"],
      "createdAt": "2026-10-30T10:45:00Z",
      "updatedAt": "2026-10-30T10:45:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have access to view this task." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found." }
        ```

---

#### 4. `PATCH /task_management/api/v1/tasks/{id}`

- **Purpose:** Partially updates task fields (title, description, priority, assignee, due date, tags, or Kanban status). When status is modified (e.g. via drag-and-drop):
    1. Validates that the target status is a valid column slug in the project.
    2. Writes an audit entry to `project_activities` documenting `fromStatus` $\rightarrow$ `toStatus`.
    3. Clears the associated Redis dashboard KPI caches (`kpi:dashboard:*` and `kpi:analytics:*`).
- **Scoping & RBAC:**
    - **Admin:** Can update any task.
    - **Member:** Can update tasks within their assigned projects.
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Path Parameters:**
    - `id` (`UUID`, required) — Task UUID identifier.
- **Query Parameters:** None
- **Request Body (Kanban Move Example):**
    ```json
    {
      "status": "in_progress"
    }
    ```
- **Positive Response Scenario A (Task Status Updated via Kanban Drag):**
    - HTTP 200 OK:
    
    ```json
    {
      "id": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f",
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "title": "Implement Drag and Drop Kanban Transitions",
      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",
      "priority": "medium",
      "status": "in_progress",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-10",
      "tags": ["frontend", "kanban", "ux"],
      "createdAt": "2026-10-30T10:45:00Z",
      "updatedAt": "2026-10-30T11:00:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "The specified assignee is not a member of this project." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have permission to modify this task." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found." }
        ```

---

#### 5. `DELETE /task_management/api/v1/tasks/{id}`

- **Purpose:** Deletes a task and its related activity audit entries. Invalidates affected project dashboard and analytics cache keys.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Task UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Task Deleted):**
    - HTTP 200 OK:
    
    ```json
    {
      "success": true,
      "message": "Task deleted successfully."
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to delete tasks." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found." }
        ```

---

#### 6. `POST /task_management/api/v1/tasks/{id}/restore`

- **Purpose:** Restores a soft-deleted task back to its active column on the Kanban board. Automatically resets `is_deleted = False` and invalidates the project dashboard cache.
- **Scoping & RBAC:**
    - Protected. Requires valid access token. Accessible to Admins and assigned project members.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Task UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Task Restored):**
    - HTTP 200 OK — Returns restored task object:
    
    ```json
    {
      "id": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f",
      "projectId": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
      "title": "Implement Drag and Drop Kanban Transitions",
      "description": "Add HTML5 drag and drop handlers and call PATCH /tasks/{id} on drop.",
      "priority": "medium",
      "status": "todo",
      "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "dueDate": "2026-11-10",
      "tags": ["frontend", "kanban", "ux"],
      "isDeleted": false,
      "createdAt": "2026-10-30T10:45:00Z",
      "updatedAt": "2026-10-30T11:15:00Z"
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Could not validate credentials." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found." }
        ```

---

### Router 4: Members (`/members`) — 5 Endpoints

#### 1. `GET /task_management/api/v1/members`

- **Purpose:** Retrieves the directory of workspace members and their public profile information. Password hashes are strictly excluded from the serialization model.
- **Scoping & RBAC:**
    - Protected. Accessible to any authenticated user (`admin` or `member`).
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Members Directory Retrieved):**
    - HTTP 200 OK — Array of member public profiles:
    
    ```json
    [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "System Admin",
        "email": "admin@teamboard.com",
        "role": "admin",
        "designation": "System Administrator",
        "joiningDate": "2026-09-01",
        "status": "active",
        "requiresPasswordChange": false
      },
      {
        "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "name": "Alex Mercer",
        "email": "alex.mercer@company.com",
        "role": "member",
        "designation": "Senior Backend Engineer",
        "joiningDate": "2026-11-01",
        "status": "active",
        "requiresPasswordChange": false
      }
    ]
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Could not validate credentials." }
        ```

---

#### 2. `POST /task_management/api/v1/members/invite`

- **Purpose:** Creates an onboarded member account in `users` with `requires_password_change = true`, generates a cryptographic signed invitation token (valid for 3 days), renders an HTML welcome email using Jinja2 (`templates/invitation_email.html`), and queues the email for non-blocking asynchronous SMTP delivery via FastAPI `BackgroundTasks`.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "name": "Sarah Connor",
      "email": "sarah.connor@company.com",
      "designation": "Staff DevOps Architect",
      "joiningDate": "2026-11-15"
    }
    ```
- **Positive Response Scenario A (Member Invited):**
    - HTTP 201 Created — Member created and email dispatched in background:
    
    ```json
    {
      "message": "Invitation sent successfully",
      "member": {
        "id": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22",
        "name": "Sarah Connor",
        "email": "sarah.connor@company.com",
        "role": "member",
        "designation": "Staff DevOps Architect",
        "joiningDate": "2026-11-15",
        "status": "active",
        "requiresPasswordChange": true
      },
      "invitationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMWY3Yjg4OS0xZDJlLTRiYjgtOGMxZC0xYmIyYmQzODBiMjIiLCJlbWFpbCI6InNhcmFoLmNvbm5vckBjb21wYW55LmNvbSIsImV4cCI6MTc5MzcyNDgwMH0...",
      "signupUrl": "https://teamhub.example.com/signup?email=sarah.connor@company.com&token=eyJhbGciOiJIUzI1Ni..."
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to invite new members." }
        ```
    - **HTTP 409 Conflict** | **Exception:** `DuplicateEntityException`
        ```json
        { "detail": "A user with this email already exists." }
        ```

---

#### 3. `POST /task_management/api/v1/members/{id}/resend-invite`

- **Purpose:** Re-generates a signed activation token and dispatches a fresh invitation email to an onboarded member who has not yet completed initial password setup or whose link expired.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Member UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Invitation Re-dispatched):**
    - HTTP 200 OK:
    
    ```json
    {
      "message": "Invitation email re-dispatched successfully",
      "member": {
        "id": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22",
        "name": "Sarah Connor",
        "email": "sarah.connor@company.com",
        "role": "member",
        "designation": "Staff DevOps Architect",
        "joiningDate": "2026-11-15",
        "status": "active",
        "requiresPasswordChange": true
      },
      "invitationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMWY3Yjg4OS0xZDJlLTRiYjgtOGMxZC0xYmIyYmQzODBiMjIiLCJlbWFpbCI6InNhcmFoLmNvbm5vckBjb21wYW55LmNvbSIsImV4cCI6MTc5MzcyNDgwMH0...",
      "signupUrl": "https://teamhub.example.com/signup?email=sarah.connor@company.com&token=eyJhbGciOiJIUzI1Ni..."
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to resend invitations." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Member with identifier 'c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22' not found." }
        ```

---

#### 4. `PATCH /task_management/api/v1/members/{id}`

- **Purpose:** Updates member profile information (name, designation, role, status, or password).
- **Scoping & RBAC:**
    - **Admin:** Can update any member's profile, designation, status, or elevate/demote roles.
    - **Member:** Can only update their own profile fields (`name`, `designation`, `password`); cannot modify `role` or `status` (rejected with `403 Forbidden`).
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Path Parameters:**
    - `id` (`UUID`, required) — Member UUID identifier.
- **Query Parameters:** None
- **Request Body:**
    ```json
    {
      "name": "Sarah Connor",
      "designation": "Principal Site Reliability Engineer"
    }
    ```
- **Positive Response Scenario A (Profile Updated):**
    - HTTP 200 OK:
    
    ```json
    {
      "id": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22",
      "name": "Sarah Connor",
      "email": "sarah.connor@company.com",
      "role": "member",
      "designation": "Principal Site Reliability Engineer",
      "joiningDate": "2026-11-15",
      "status": "active",
      "requiresPasswordChange": true
    }
    ```

- **Negative Scenarios:**
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Members are not permitted to modify member roles or statuses." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Member with identifier 'c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22' not found." }
        ```

---

#### 5. `DELETE /task_management/api/v1/members/{id}`

- **Purpose:** Safely removes a member from the workspace. Automatically removes the member from all `project_members` relationships, resets their active task assignments to `assignee_id = NULL` (preventing orphan tasks or dangling keys), and blacklists any active access tokens. Protects system integrity by blocking deletion of the last remaining admin in the organization.
- **Scoping & RBAC:**
    - **Admin Only:** Members receive `403 Forbidden`.
- **Headers:** `Authorization: Bearer <admin_token>`
- **Path Parameters:**
    - `id` (`UUID`, required) — Member UUID identifier.
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (Member Safely Deleted):**
    - HTTP 204 No Content — Empty response body.
- **Negative Scenarios:**
    - **HTTP 400 Bad Request** | **Exception:** `ValidationException`
        ```json
        { "detail": "Cannot delete the last remaining organization administrator." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Only workspace administrators are permitted to delete members." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Member with identifier 'c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22' not found." }
        ```

---

### Router 5: Dashboard & Analytics (`/dashboard`, `/analytics`) — 2 Endpoints

#### 1. `GET /task_management/api/v1/dashboard/stats`

- **Purpose:** Computes role-specific overview KPIs, status counters, upcoming workload, and recent activity history required by the main dashboard page.
- **Scoping & RBAC:**
    - **When accessed by Admin:** Returns global workspace-wide statistics (`totalProjects`, `totalTasks`, `completedTasks`, `overdueTasks`, `recentlyCreatedTasks`, and `recentActivity`).
    - **When accessed by Member:** Automatically scopes metrics strictly to the authenticated user's assigned projects and tasks (`myAssignedTasks`, `myOverdueTasks`, `tasksDueSoon`, and `myProjects`).
- **Caching & Invalidation:** Cached in Redis at `kpi:dashboard:{role}:{user_id}` for 60 seconds. Automatically invalidated whenever any task or project in the workspace is created, updated, or deleted. Gracefully falls back to direct PostgreSQL aggregation on cache miss or Redis unavailability.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (When Called by Admin — Global Workspace Scope):**
    - HTTP 200 OK — Workspace-wide aggregates across all projects and tasks:
    
    ```json
    {
      "totalProjects": 8,
      "totalTasks": 24,
      "completedTasks": 12,
      "overdueTasks": 2,
      "recentlyCreatedTasks": [
        {
          "id": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
          "projectId": "98084b00-fca4-4191-8a33-aa2c51596b4b",
          "title": "Build Docker Image",
          "description": "Create production multistage Dockerfile",
          "priority": "high",
          "status": "todo",
          "assigneeId": "550e8400-e29b-41d4-a716-446655440000",
          "dueDate": "2026-11-05",
          "tags": ["docker", "devops"],
          "createdAt": "2026-10-30T06:35:26Z",
          "updatedAt": "2026-10-30T06:36:09Z"
        }
      ],
      "recentActivity": [
        {
          "id": "c54c1e74-b8b8-42b5-9248-7b8dcf96421a",
          "projectId": "98084b00-fca4-4191-8a33-aa2c51596b4b",
          "taskId": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
          "taskTitle": "Build Docker Image",
          "userId": "550e8400-e29b-41d4-a716-446655440000",
          "userName": "System Admin",
          "fromStatus": "in_progress",
          "toStatus": "done",
          "createdAt": "2026-10-30T06:36:09Z"
        }
      ]
    }
    ```

- **Positive Response Scenario B (When Called by Member — Assigned Scope):**
    - HTTP 200 OK — Scoped strictly to projects the member belongs to and tasks assigned to them:
    
    ```json
    {
      "myAssignedTasks": [
        {
          "id": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
          "projectId": "98084b00-fca4-4191-8a33-aa2c51596b4b",
          "title": "Implement Drag and Drop",
          "description": "Cross-column Kanban moves",
          "priority": "medium",
          "status": "in_progress",
          "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
          "dueDate": "2026-11-10",
          "tags": ["frontend", "kanban"],
          "createdAt": "2026-10-30T06:35:26Z",
          "updatedAt": "2026-10-30T06:36:09Z"
        }
      ],
      "myOverdueTasks": [],
      "tasksDueSoon": [
        {
          "id": "084b79b8-61ec-46ff-bec5-bde1ecdeaace",
          "projectId": "98084b00-fca4-4191-8a33-aa2c51596b4b",
          "title": "Implement Drag and Drop",
          "dueDate": "2026-11-10",
          "priority": "medium",
          "status": "in_progress"
        }
      ],
      "myProjects": [
        {
          "id": "98084b00-fca4-4191-8a33-aa2c51596b4b",
          "name": "Live E2E Workspace",
          "status": "active",
          "progress": 40
        }
      ]
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Authorization credentials missing or invalid." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "Password change required before accessing this resource." }
        ```

---

#### 2. `GET /task_management/api/v1/analytics/data`

- **Purpose:** Computes pre-aggregated status distribution, member workloads, and 7-day chronological completion trajectories required by the frontend Recharts visualizations (`PieChart` for Tasks by Status, `BarChart` for Tasks by Assignee, and `LineChart` for Completion Trends).
- **Scoping & RBAC:**
    - **When accessed by Admin:** Computes metrics across the entire workspace (all projects and members) or scoped to a specific project if `projectId` is passed.
    - **When accessed by Member:** Automatically scopes metrics to projects where the member is assigned; if `projectId` is provided for a project the member does not belong to, access is rejected with `403 Forbidden`.
- **Caching & Invalidation:** Cached in Redis at `kpi:analytics:{project_id_or_all}` for 300 seconds (5 minutes). Re-computed on cache miss or project/task mutation events.
- **Headers:** `Authorization: Bearer <access_token>`
- **Path Parameters:** None
- **Query Parameters:**
    - `projectId` (`UUID`, optional) — Scope metrics to a specific project; if omitted, aggregates across all accessible projects.
- **Request Body:** None
- **Positive Response Scenario A (When Called by Admin — Workspace / All Projects Scope):**
    - HTTP 200 OK — Pre-calculated chart metrics for Recharts:
    
    ```json
    {
      "statusDistribution": [
        { "name": "Backlog", "value": 2, "color": "#94a3b8" },
        { "name": "To Do", "value": 5, "color": "#64748b" },
        { "name": "In Progress", "value": 4, "color": "#3b82f6" },
        { "name": "Done", "value": 7, "color": "#22c55e" }
      ],
      "tasksByAssignee": [
        { "assignee": "System Admin", "name": "System", "count": 6, "tasksCount": 6 },
        { "assignee": "Alex Mercer", "name": "Alex", "count": 4, "tasksCount": 4 },
        { "assignee": "Sarah Connor", "name": "Sarah", "count": 3, "tasksCount": 3 }
      ],
      "completionTrends": [
        { "date": "2026-10-24", "completed": 1, "completedCount": 1 },
        { "date": "2026-10-25", "completed": 3, "completedCount": 3 },
        { "date": "2026-10-26", "completed": 2, "completedCount": 2 },
        { "date": "2026-10-27", "completed": 0, "completedCount": 0 },
        { "date": "2026-10-28", "completed": 4, "completedCount": 4 },
        { "date": "2026-10-29", "completed": 1, "completedCount": 1 },
        { "date": "2026-10-30", "completed": 2, "completedCount": 2 }
      ]
    }
    ```

- **Positive Response Scenario B (When Filtered by Specific Project — `?projectId=98084b00-...`):**
    - HTTP 200 OK — Metrics scoped exclusively to the specified project:
    
    ```json
    {
      "statusDistribution": [
        { "name": "Backlog", "value": 0, "color": "#94a3b8" },
        { "name": "To Do", "value": 1, "color": "#64748b" },
        { "name": "In Progress", "value": 2, "color": "#3b82f6" },
        { "name": "Done", "value": 1, "color": "#22c55e" }
      ],
      "tasksByAssignee": [
        { "assignee": "System Admin", "name": "System", "count": 2, "tasksCount": 2 },
        { "assignee": "Alex Mercer", "name": "Alex", "count": 2, "tasksCount": 2 }
      ],
      "completionTrends": [
        { "date": "2026-10-24", "completed": 0, "completedCount": 0 },
        { "date": "2026-10-25", "completed": 0, "completedCount": 0 },
        { "date": "2026-10-26", "completed": 1, "completedCount": 1 },
        { "date": "2026-10-27", "completed": 0, "completedCount": 0 },
        { "date": "2026-10-28", "completed": 0, "completedCount": 0 },
        { "date": "2026-10-29", "completed": 0, "completedCount": 0 },
        { "date": "2026-10-30", "completed": 0, "completedCount": 0 }
      ]
    }
    ```

- **Negative Scenarios:**
    - **HTTP 401 Unauthorized** | **Exception:** `UnauthorizedException`
        ```json
        { "detail": "Authorization credentials missing or invalid." }
        ```
    - **HTTP 403 Forbidden** | **Exception:** `ForbiddenException`
        ```json
        { "detail": "You do not have access to view analytics for this project." }
        ```
    - **HTTP 404 Not Found** | **Exception:** `EntityNotFoundException`
        ```json
        { "detail": "Project with identifier '98084b00-fca4-4191-8a33-aa2c51596b4b' not found." }
        ```
    - **HTTP 422 Unprocessable Content**
        ```json
        {
          "detail": [
            {
              "loc": ["query", "projectId"],
              "msg": "Input should be a valid UUID",
              "type": "uuid_parsing"
            }
          ]
        }
        ```

---

### Router 6: HTMX Server-Rendered Components (`/htmx`) — 2 Endpoints

#### 1. `GET /htmx/dashboard`

- **Purpose:** Renders the complete, responsive server-side HTML dashboard interface using Jinja2 templates (`templates/dashboard_page.html`) styled with Tailwind CSS. Incorporates initial KPI counters, project rosters, and embed HTMX polling attributes (`data-hx-get="/htmx/dashboard/stats"`, `data-hx-trigger="every 30s"`, `data-hx-target="#kpi-stats-container"`, `data-hx-swap="innerHTML"`) for live DOM updates without full-page reloads.
- **Scoping & RBAC:**
    - Supports flexible user resolution for browser demos: checks `Authorization: Bearer <token>`, `?token=<jwt_token>` query parameter, developer headers (`x-user-id`, `x-user-role`), or falls back to the workspace administrator for direct navigation.
- **Headers:** `Authorization: Bearer <access_token>` (optional if `?token=` parameter is provided)
- **Path Parameters:** None
- **Query Parameters:**
    - `token` (`string`, optional) — JWT access token for direct browser address bar testing.
- **Request Body:** None
- **Positive Response Scenario A (Full HTML Page Rendered):**
    - HTTP 200 OK — `Content-Type: text/html; charset=utf-8`:
    
    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Team Hub - Real-Time Dashboard</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 min-h-screen text-slate-800">
      <header class="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 class="text-xl font-bold text-indigo-600">Team Hub</h1>
        <div class="text-sm text-slate-500">Logged in as: <span class="font-medium text-slate-800">System Admin</span></div>
      </header>
      <main class="max-w-7xl mx-auto px-6 py-8">
        <!-- HTMX Live Polling Container -->
        <section id="kpi-stats-container" hx-get="/htmx/dashboard/stats" hx-trigger="every 30s" hx-swap="innerHTML">
          <!-- Server-rendered initial KPI card snippet -->
        </section>
      </main>
    </body>
    </html>
    ```

- **Negative Scenarios:**
    - **HTTP 500 Internal Server Error**
        ```json
        { "detail": "Template rendering exception encountered while generating dashboard page." }
        ```

---

#### 2. `GET /htmx/dashboard/stats`

- **Purpose:** Generates a lightweight, modular HTML partial fragment containing real-time KPI metric cards (`templates/dashboard_stats_fragment.html`). Polled automatically every 30 seconds by HTMX on the client to refresh total projects, total tasks, completed velocity, and overdue badges seamlessly.
- **Caching & Performance:** Leverages the shared asynchronous Redis dashboard cache (`TTL: 60s`). When the cache is warm, serving this fragment requires 0 database queries, guaranteeing sub-5ms response times during periodic polling loops.
- **Headers:** `Authorization: Bearer <access_token>` (optional if `?token=` parameter is passed)
- **Path Parameters:** None
- **Query Parameters:**
    - `token` (`string`, optional) — JWT access token.
- **Request Body:** None
- **Positive Response Scenario A (HTML Partial Fragment Returned):**
    - HTTP 200 OK — `Content-Type: text/html; charset=utf-8`:
    
    ```html
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Projects</div>
        <div class="mt-2 text-3xl font-extrabold text-slate-900">8</div>
        <div class="mt-1 text-xs text-slate-500">Active workspaces</div>
      </div>
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</div>
        <div class="mt-2 text-3xl font-extrabold text-indigo-600">24</div>
        <div class="mt-1 text-xs text-slate-500">Across all columns</div>
      </div>
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</div>
        <div class="mt-2 text-3xl font-extrabold text-emerald-600">12</div>
        <div class="mt-1 text-xs text-emerald-600 font-medium">50% completion rate</div>
      </div>
      <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Tasks</div>
        <div class="mt-2 text-3xl font-extrabold text-rose-600">2</div>
        <div class="mt-1 text-xs text-rose-500 font-medium">Requires attention</div>
      </div>
    </div>
    ```

- **Negative Scenarios:**
    - **HTTP 500 Internal Server Error**
        ```json
        { "detail": "Error rendering KPI stats fragment." }
        ```

---

### Router 7: Operational Health Probe (`/health`) — 1 Endpoint

#### 1. `GET /task_management/api/v1/health`

- **Purpose:** Operational readiness, liveness, and uptime health check probe designed for container orchestration (Render, Docker healthchecks, Kubernetes probes) and synthetic uptime monitors. Performs live connection tests against:
    1. **PostgreSQL Database:** Executes `SELECT 1` via SQLAlchemy `AsyncSession`.
    2. **Redis In-Memory Store:** Sends `PING` command via asynchronous `redis-py` client with a 2.0-second network socket timeout.
- **Scoping & RBAC:**
    - **Access:** Public (No authorization required).
- **Headers:** None
- **Path Parameters:** None
- **Query Parameters:** None
- **Request Body:** None
- **Positive Response Scenario A (All Services Healthy & Connected):**
    - HTTP 200 OK — Both PostgreSQL and Redis are responsive:
    
    ```json
    {
      "status": "healthy",
      "timestamp": "2026-10-30T10:30:00Z",
      "services": {
        "database": "connected",
        "redis": "connected"
      }
    }
    ```

- **Negative Scenarios (Degraded Dependency Response):**
    - **HTTP 503 Service Unavailable** — Returned when PostgreSQL or Redis fails to respond within timeout limits:
    
    ```json
    {
      "status": "unhealthy",
      "timestamp": "2026-10-30T10:30:00Z",
      "services": {
        "database": "disconnected",
        "redis": "connected"
      }
    }
    ```

---

## 5. Pydantic Schemas & Data Contracts

Pydantic schemas enforce incoming request body validation and outgoing JSON response serialization.

```python
import uuid
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

# ===========================================================================
# Base Configuration (camelCase JSON / snake_case Python & ORM Mapping)
# ===========================================================================
class CamelCaseModel(BaseModel):
    """
    Base schema supporting:
    - camelCase JSON request payloads and outgoing response serialization
    - snake_case Python attributes
    - from_attributes=True for direct SQLAlchemy ORM object serialization
    - Automatic whitespace stripping
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        str_strip_whitespace=True,
    )


# ===========================================================================
# 5.1 Pydantic Request Body Schemas (Input Validation)
# ===========================================================================

# --- Authentication Requests ---
class LoginRequest(BaseModel):
    """Used for: POST /task_management/api/v1/auth/login"""
    model_config = ConfigDict(extra="ignore", strict=False)

    email: EmailStr
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: Optional[bool] = Field(default=False, alias="rememberMe")

class RefreshTokenRequest(BaseModel):
    """Used for: POST /task_management/api/v1/auth/refresh"""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    refresh_token: str = Field(..., min_length=20, alias="refreshToken", description="7-day refresh token")

class ChangePasswordRequest(CamelCaseModel):
    """Used for: PATCH /task_management/api/v1/auth/change-password"""
    current_password: str = Field(..., min_length=1, description="Current password")
    new_password: str = Field(..., min_length=6, description="New password")
    confirm_password: Optional[str] = Field(default=None, description="Password confirmation")

    @model_validator(mode="after")
    def validate_new_passwords_match(self):
        if self.confirm_password and self.new_password != self.confirm_password:
            raise ValueError("newPassword and confirmPassword do not match")
        if self.current_password and self.new_password == self.current_password:
            raise ValueError("New password cannot be the same as current password")
        return self

class SignupRequest(CamelCaseModel):
    """Used for: POST /task_management/api/v1/auth/signup"""
    email: EmailStr
    token: Optional[str] = Field(default=None, description="Invitation security token")
    new_password: str = Field(..., min_length=6, description="Initial account password")
    confirm_password: Optional[str] = Field(default=None)

    @model_validator(mode="after")
    def validate_signup_passwords_match(self):
        if self.confirm_password and self.new_password != self.confirm_password:
            raise ValueError("newPassword and confirmPassword do not match")
        return self


# --- Member Requests ---
class MemberInviteRequest(CamelCaseModel):
    """Used for: POST /task_management/api/v1/members/invite"""
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    designation: Optional[str] = Field(default="Contributor", max_length=150)
    joining_date: Optional[date] = None

class MemberUpdateRequest(CamelCaseModel):
    """Used for: PATCH /task_management/api/v1/members/{id}"""
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    designation: Optional[str] = Field(default=None, max_length=150)
    role: Optional[str] = Field(default=None, pattern="^(admin|member)$")
    status: Optional[str] = Field(default=None, pattern="^(active|invited|suspended)$")


# --- Project Requests ---
class ProjectCreate(CamelCaseModel):
    """Used for: POST /task_management/api/v1/projects"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    status: Optional[str] = Field(default="planning", pattern="^(planning|active|completed|on-hold|archived)$")
    category: Optional[str] = "General"
    priority: Optional[str] = Field(default="medium", pattern="^(low|medium|high|critical)$")
    start_date: date
    due_date: date
    member_ids: List[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.due_date < self.start_date:
            raise ValueError("dueDate cannot be earlier than startDate")
        return self

class ProjectUpdate(CamelCaseModel):
    """Used for: PATCH /task_management/api/v1/projects/{id}"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(planning|active|completed|on-hold|archived)$")
    category: Optional[str] = None
    priority: Optional[str] = Field(default=None, pattern="^(low|medium|high|critical)$")
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    member_ids: Optional[List[uuid.UUID]] = None
    kanban_columns: Optional[List[Dict[str, Any]]] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("dueDate cannot be earlier than startDate")
        return self


# --- Dynamic Kanban Column Requests ---
class ColumnCreate(CamelCaseModel):
    """Used for: POST /task_management/api/v1/projects/{id}/columns"""
    name: str = Field(..., min_length=1, max_length=100, description="Column display title")
    color: Optional[str] = Field(default="bg-purple-50 border-purple-200 text-purple-800")

class ColumnReorder(CamelCaseModel):
    """Used for: PUT /task_management/api/v1/projects/{id}/columns/reorder"""
    column_ids: List[str] = Field(..., description="Ordered array of column slug identifiers")


# --- Task Requests ---
class TaskCreate(CamelCaseModel):
    """Used for: POST /task_management/api/v1/tasks"""
    project_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    priority: Optional[str] = Field(default="medium", pattern="^(low|medium|high|critical)$")
    status: str = Field(default="todo", description="Column slug or standard status")
    assignee_id: Optional[uuid.UUID] = None
    due_date: date
    tags: List[str] = Field(default_factory=list)

class TaskUpdate(CamelCaseModel):
    """Used for: PATCH /task_management/api/v1/tasks/{id} (Kanban moves & edits)"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    priority: Optional[str] = Field(default=None, pattern="^(low|medium|high|critical)$")
    status: Optional[str] = Field(default=None, description="New column slug / status")
    assignee_id: Optional[uuid.UUID] = None
    due_date: Optional[date] = None
    tags: Optional[List[str]] = None


# ===========================================================================
# 5.2 Pydantic Response Body Schemas (Output Serialization)
# ===========================================================================

# --- Auth & User Responses ---
class UserSummary(CamelCaseModel):
    """User representation included in authentication payloads"""
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    status: str
    designation: Optional[str] = None
    requires_password_change: bool = False

class LoginResponse(BaseModel):
    """Returned by: POST /task_management/api/v1/auth/login"""
    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(alias="accessToken")
    refresh_token: Optional[str] = Field(default=None, alias="refreshToken")
    token_type: str = Field(default="Bearer", alias="tokenType")
    user: UserSummary

class TokenResponse(BaseModel):
    """Returned by: POST /task_management/api/v1/auth/refresh"""
    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(alias="accessToken")
    token_type: str = Field(default="Bearer", alias="tokenType")

class UserMeResponse(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/auth/me"""
    id: uuid.UUID
    email: EmailStr
    name: str
    role: str
    status: str
    designation: Optional[str] = None
    avatar: Optional[str] = None
    created_at: Optional[str] = None

class ChangePasswordResponse(CamelCaseModel):
    """Returned by: PATCH /auth/change-password and POST /auth/signup"""
    message: str
    user: UserSummary

class MessageResponse(BaseModel):
    """Returned by: POST /auth/logout and generic operational responses"""
    message: str


# --- Member Directory Responses ---
class UserRead(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/members"""
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    designation: Optional[str] = "Contributor"
    joining_date: date
    status: str = "active"
    requires_password_change: bool = False

class MemberInviteResponse(CamelCaseModel):
    """Returned by: POST /task_management/api/v1/members/invite"""
    message: str
    member: UserRead


# --- Project Responses ---
class KanbanColumnSchema(CamelCaseModel):
    """Representation of a project's Kanban workflow column"""
    id: str
    label: str
    status: str
    color: str
    is_custom: bool = False
    order: Optional[int] = None

class ProjectOut(CamelCaseModel):
    """Returned by: GET /projects, POST /projects, GET /projects/{id}, PATCH /projects/{id}"""
    id: uuid.UUID
    name: str
    description: Optional[str] = ""
    status: str
    previous_status: Optional[str] = None
    category: str
    priority: str
    start_date: date
    due_date: date
    progress: int = 0
    member_ids: List[uuid.UUID] = Field(default_factory=list)
    kanban_columns: List[KanbanColumnSchema] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

class PaginationMeta(CamelCaseModel):
    """Pagination metadata container"""
    total_items: int
    page: int
    page_size: int
    total_pages: int
    has_next_page: bool
    has_prev_page: bool

class PaginatedProjectsResponse(CamelCaseModel):
    """Paginated project list envelope"""
    items: List[ProjectOut]
    pagination: PaginationMeta

class ProjectActivityOut(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/projects/{id}/activities"""
    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    user_id: Optional[uuid.UUID] = None
    user_name: str
    from_status: str
    to_status: str
    created_at: datetime

class ProjectDeleteResponse(CamelCaseModel):
    """Returned by: DELETE /task_management/api/v1/projects/{id}"""
    success: bool = True
    message: str = "Project deleted successfully."


# --- Dynamic Column Responses ---
class ColumnOut(CamelCaseModel):
    """Returned by: GET /projects/{id}/columns, POST /projects/{id}/columns, PUT /projects/{id}/columns/reorder"""
    id: str
    project_id: Union[uuid.UUID, str]
    name: str
    slug: str
    order: int
    color: str


# --- Task Responses ---
class TaskOut(CamelCaseModel):
    """Returned by: GET /tasks, POST /tasks, GET /tasks/{id}, PATCH /tasks/{id}"""
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str] = ""
    priority: str
    status: str
    assignee_id: Optional[uuid.UUID] = None
    due_date: date
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

class PaginatedTasksResponse(CamelCaseModel):
    """Paginated task list envelope"""
    items: List[TaskOut]
    pagination: PaginationMeta

class TaskDeleteResponse(CamelCaseModel):
    """Returned by: DELETE /task_management/api/v1/tasks/{id}"""
    success: bool = True
    message: str = "Task deleted successfully."


# --- Dashboard & Analytics Responses ---
class AdminDashboardData(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/dashboard/stats (Admin scope)"""
    total_projects: int
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    recently_created_tasks: List[TaskOut] = Field(default_factory=list)
    recent_activity: List[ProjectActivityOut] = Field(default_factory=list)

class MemberDashboardData(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/dashboard/stats (Member scope)"""
    my_assigned_tasks: List[TaskOut] = Field(default_factory=list)
    my_overdue_tasks: List[TaskOut] = Field(default_factory=list)
    tasks_due_soon: List[TaskOut] = Field(default_factory=list)
    my_projects: List[ProjectOut] = Field(default_factory=list)

class StatusDistributionItem(CamelCaseModel):
    """Pie chart slice for status distribution"""
    name: str
    value: int
    color: Optional[str] = None

class AssigneeDistributionItem(CamelCaseModel):
    """Bar chart workload item for tasks by assignee"""
    assignee: str
    name: Optional[str] = None
    count: int
    tasks_count: Optional[int] = None

class CompletionTrendItem(CamelCaseModel):
    """Line chart data point for 7-day completion trajectory"""
    date: str
    completed: int
    completed_count: Optional[int] = None

class AnalyticsDataResponse(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/analytics/data"""
    status_distribution: List[StatusDistributionItem]
    tasks_by_assignee: List[AssigneeDistributionItem]
    completion_trends: List[CompletionTrendItem]


# --- Health Check Response ---
class ServiceStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"

class HealthResponse(CamelCaseModel):
    """Returned by: GET /task_management/api/v1/health"""
    status: Literal["healthy", "unhealthy"]
    timestamp: str
    services: Dict[str, ServiceStatus]
```

---

## 6. QA Verification Matrix & Test Strategy

| Test Domain | Target Endpoints | Primary Verifications | Success Criteria |
| :--- | :--- | :--- | :--- |
| **Authentication & Tokens** | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password` | JWT signing, expiration handling, Redis token revocation blacklist, password hashing. | Valid credentials return tokens (`200 OK`); revoked/expired tokens return `401 Unauthorized`. |
| **RBAC Authorization** | Project creation/deletion, Member invites, Custom Column creation | Permission checks across `admin` and `member` roles. | Admins permitted (`200/201/204`); members attempting admin operations receive `403 Forbidden`. |
| **Dynamic Kanban Columns** | `/projects/{id}/columns*` | Adding custom columns, unique slug generation, maximum 8 columns constraint, column reordering. | Rejects duplicate column names with `409 Conflict`; column deletion safely migrates tasks to `backlog`. |
| **Task Drag & Drop** | `PATCH /tasks/{id}` | Task status transition, business rule checks (e.g. todo cannot jump directly to done), activity audit logs. | Status updates immediately; writes event to `project_activities`; flushes Redis cache. |
| **Member Onboarding** | `POST /members/invite` | Jinja2 template rendering, async background email dispatch, forced password change flag. | Returns `201 Created`; sets `requiresPasswordChange = true`; delivers HTML email credentials. |
| **Dashboard & Analytics** | `/dashboard/stats`, `/analytics/data` | Role-based KPI filtering, Recharts data aggregation, Redis 60s/300s TTL, fallback on Redis failure. | Returns pre-computed chart metrics; gracefully falls back to PostgreSQL on cache miss or Redis failure. |
| **HTMX Server-Side Rendering** | `/htmx/dashboard*` | HTML rendering via Jinja2, HTMX 30-second partial polling fragment swap. | Returns `200 OK` with `Content-Type: text/html`; fragment updates dynamically without page reloads. |
| **Operational Health** | `GET /health` | Live PostgreSQL and Redis connection validation. | Returns `200 OK` when connected; accurately flags degraded service with `503 Service Unavailable`. |
