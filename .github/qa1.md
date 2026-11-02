## **Base URL Prefix**

### **Base URL:** `https://workstream-backend-1rr8.onrender.com/task_management/api/v1`

</aside>

## Credentials

- **Admin:** Email: admin@teamboard.com
- password: Admin@123

## Database connection

- **Host: postgresql://teamhub_vj36_user:bvBLm7q49dlLVmOZdXQ7edLUpsOONPOB@dpg-dbi6hb6tlv9c7390ga9g-a.oregon-postgres.render.com/teamhub_vj36**
- **User: teamhub_vj36_user**
- **Password: bvBLm7q49dlLVmOZdXQ7edLUpsOONPOB**
- **Database:  teamhub_vj36**

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
      "avatar": "<https://api.dicebear.com/7.x/avataaars/svg?seed=System%20Admin>",
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
      "avatar": "<https://api.dicebear.com/7.x/avataaars/svg?seed=Alex%20Mercer>",
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

### Router 3: Tasks (`/tasks`) — 5 Endpoints

#### 1. `GET /task_management/api/v1/tasks`

- **Purpose:** Retrieves tasks matching filter criteria. Operates in dual response modes: returns standard paginated envelopes when pagination parameters are provided, or flat lists for Kanban boards and list views. Supports filtering by project, workflow status, priority, assignee, and due date.
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
      "signupUrl": "<https://teamhub.example.com/signup?email=sarah.connor@company.com&token=eyJhbGciOiJIUzI1Ni>..."
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
      "signupUrl": "<https://teamhub.example.com/signup?email=sarah.connor@company.com&token=eyJhbGciOiJIUzI1Ni>..."
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
      <script src="<https://unpkg.com/htmx.org@1.9.10>"></script>
      <script src="<https://cdn.tailwindcss.com>"></script>
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