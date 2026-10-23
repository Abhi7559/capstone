# API_SPECIFICATION.md

> **Status:** PROPOSED API CONTRACT (v1.0.0)  
> **Base Path:** `/api/v1`  
> **Security:** Bearer Token via `Authorization: Bearer <access_token>`

---

## 1. Authentication Endpoints

### 1.1 Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Purpose:** Authenticate user and issue access and refresh tokens.
- **Authentication:** Public
- **Request Body:**
  ```json
  {
    "email": "admin@teamboard.com",
    "password": "Admin@123"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
      "token_type": "bearer",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "System Admin",
        "email": "admin@teamboard.com",
        "role": "admin",
        "status": "active",
        "designation": "System Administrator",
        "joiningDate": "2026-09-01",
        "requiresPasswordChange": false
      }
    }
    ```
  - `401 Unauthorized`: `{ "detail": "Invalid email or password" }`
  - `422 Unprocessable Entity`: Validation errors

### 1.2 Change Password
- **Endpoint:** `POST /api/v1/auth/change-password`
- **Purpose:** Update user password and clear `requires_password_change` flag.
- **Authentication:** Required (Bearer Token)
- **Request Body:**
  ```json
  {
    "email": "abhishek@gmail.com",
    "currentPassword": "OldPassword@123",
    "newPassword": "NewStrongPassword@2026",
    "confirmPassword": "NewStrongPassword@2026"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "message": "Password updated successfully",
      "user": {
        "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "email": "abhishek@gmail.com",
        "requiresPasswordChange": false
      }
    }
    ```
  - `400 Bad Request`: `{ "detail": "New passwords do not match or fail complexity rules" }`
  - `401 Unauthorized`: `{ "detail": "Current password incorrect" }`

### 1.3 Refresh Token
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Purpose:** Exchange valid refresh token for a new access token.
- **Authentication:** Public (Refresh token in payload or cookie)
- **Request Body:** `{ "refresh_token": "..." }`
- **Responses:**
  - `200 OK`: `{ "access_token": "...", "token_type": "bearer" }`
  - `401 Unauthorized`: `{ "detail": "Invalid or expired refresh token" }`

---

## 2. Dashboard & Analytics Endpoints

### 2.1 Get Dashboard Statistics
- **Endpoint:** `GET /api/v1/dashboard/stats`
- **Purpose:** Retrieve role-tailored dashboard metrics and activity.
- **Authentication:** Required (Admin or Member)
- **Query Parameters:** None
- **Responses:**
  - `200 OK (Admin Response)`:
    ```json
    {
      "totalProjects": 8,
      "totalTasks": 34,
      "completedTasks": 19,
      "overdueTasks": 2,
      "recentlyCreatedTasks": [
        {
          "id": "task-uuid",
          "projectId": "proj-uuid",
          "title": "Setup PostgreSQL asyncpg",
          "priority": "high",
          "status": "todo",
          "assigneeId": "user-uuid",
          "dueDate": "2026-10-25",
          "tags": ["backend", "database"],
          "createdAt": "2026-10-21T10:00:00Z",
          "updatedAt": "2026-10-21T10:00:00Z"
        }
      ],
      "recentActivity": [
        {
          "id": "act-uuid",
          "type": "task_updated",
          "message": "Abhishek marked 'Setup PostgreSQL' as in_progress",
          "timestamp": "2026-10-21T10:30:00Z"
        }
      ]
    }
    ```
  - `200 OK (Member Response)`:
    ```json
    {
      "myAssignedTasks": [...],
      "myOverdueTasks": [...],
      "tasksDueSoon": [...],
      "myProjects": [...],
      "recentActivity": [...]
    }
    ```

### 2.2 Get Analytics Overview
- **Endpoint:** `GET /api/v1/analytics/overview`
- **Purpose:** Retrieve aggregated metrics for status, assignee workload, and velocity charts.
- **Authentication:** Required
- **Query Parameters:** `projectId` (string, optional, e.g. `all` or UUID)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "tasks": [...],
      "members": [...]
    }
    ```

---

## 3. Projects Endpoints

### 3.1 List Projects
- **Endpoint:** `GET /api/v1/projects`
- **Purpose:** Retrieve projects list (all projects for admin; assigned projects for member).
- **Authentication:** Required
- **Responses:**
  - `200 OK`:
    ```json
    [
      {
        "id": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
        "name": "Team Hub Platform Migration",
        "description": "Migrate mock backend to FastAPI and PostgreSQL",
        "status": "active",
        "category": "Engineering",
        "priority": "high",
        "startDate": "2026-10-01",
        "dueDate": "2026-11-15",
        "memberIds": [
          "550e8400-e29b-41d4-a716-446655440000",
          "b733e169-49d4-4d66-b4ef-2460da7a3a30"
        ],
        "createdAt": "2026-10-01T08:00:00Z"
      }
    ]
    ```

### 3.2 Create Project
- **Endpoint:** `POST /api/v1/projects`
- **Purpose:** Create a new project with member assignments.
- **Authentication:** Required (`admin` role only)
- **Request Body:**
  ```json
  {
    "name": "Team Hub Platform Migration",
    "description": "Migrate mock backend to FastAPI and PostgreSQL",
    "status": "planning",
    "category": "Engineering",
    "priority": "high",
    "startDate": "2026-10-01",
    "dueDate": "2026-11-15",
    "memberIds": ["b733e169-49d4-4d66-b4ef-2460da7a3a30"]
  }
  ```
- **Responses:**
  - `201 Created`: Project object
  - `400 Bad Request`: `{ "detail": "dueDate must be greater than or equal to startDate" }`
  - `403 Forbidden`: `{ "detail": "Only administrators can create projects" }`

### 3.3 Get Project by ID
- **Endpoint:** `GET /api/v1/projects/{id}`
- **Authentication:** Required
- **Responses:**
  - `200 OK`: Project object
  - `404 Not Found`: `{ "detail": "Project not found" }`

### 3.4 Update Project
- **Endpoint:** `PATCH /api/v1/projects/{id}`
- **Purpose:** Edit project details or toggle archive status.
- **Authentication:** Required (`admin` role only)
- **Request Body:** `Partial<UpdateProjectInput>`
- **Responses:**
  - `200 OK`: Updated Project object
  - `403 Forbidden`: Non-admin access

### 3.5 Delete Project
- **Endpoint:** `DELETE /api/v1/projects/{id}`
- **Purpose:** Delete project and cascaded tasks.
- **Authentication:** Required (`admin` role only)
- **Responses:**
  - `200 OK`: `{ "message": "Project deleted successfully" }`
  - `403 Forbidden`: Non-admin access
  - `404 Not Found`: `{ "detail": "Project not found" }`

### 3.6 Get Project Activities
- **Endpoint:** `GET /api/v1/projects/{id}/activities`
- **Purpose:** Audit log stream of task status movements in project.
- **Authentication:** Required
- **Responses:**
  - `200 OK`:
    ```json
    [
      {
        "id": "act-1",
        "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
        "taskId": "d4a9d1af-47bb-4fb4-b6c1-021b38ce5d70",
        "taskTitle": "Setup Docker",
        "userId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
        "userName": "Abhishek",
        "fromStatus": "todo",
        "toStatus": "in_progress",
        "createdAt": "2026-10-21T09:15:00Z"
      }
    ]
    ```

---

## 4. Tasks Endpoints

### 4.1 List Tasks
- **Endpoint:** `GET /api/v1/tasks`
- **Query Parameters:**
  - `projectId` (UUID, optional)
  - `status` (string, optional: `backlog`, `todo`, `in_progress`, `done`)
  - `priority` (string, optional: `low`, `medium`, `high`)
  - `assigneeId` (UUID, optional)
  - `dueDate` (YYYY-MM-DD date, optional)
- **Authentication:** Required
- **Responses:**
  - `200 OK`: List of `Task` objects matching filters.

### 4.2 Create Task
- **Endpoint:** `POST /api/v1/tasks`
- **Authentication:** Required (Admin or assigned Project Member)
- **Request Body:**
  ```json
  {
    "projectId": "6cb2d97f-2872-46dd-852d-59234f7caa5b",
    "title": "Configure Alembic migrations",
    "description": "Initialize alembic and create migration scripts",
    "priority": "high",
    "status": "todo",
    "assigneeId": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    "dueDate": "2026-10-28",
    "tags": ["backend", "migrations"]
  }
  ```
- **Responses:**
  - `201 Created`: Created `Task` object
  - `400 Bad Request`: `{ "detail": "Assignee is not a member of this project" }`
  - `403 Forbidden`: User lacks permission on this project

### 4.3 Get Task by ID
- **Endpoint:** `GET /api/v1/tasks/{id}`
- **Authentication:** Required
- **Responses:**
  - `200 OK`: `Task` object
  - `404 Not Found`: `{ "detail": "Task not found" }`

### 4.4 Update Task (Details / Status Transition)
- **Endpoint:** `PATCH /api/v1/tasks/{id}`
- **Purpose:** Update status, assignee, priority, or content. Triggers audit record when status changes.
- **Authentication:** Required
- **Request Body:**
  ```json
  {
    "status": "in_progress"
  }
  ```
- **Responses:**
  - `200 OK`: Updated `Task` object
  - `404 Not Found`: `{ "detail": "Task not found" }`

### 4.5 Delete Task
- **Endpoint:** `DELETE /api/v1/tasks/{id}`
- **Authentication:** Required (`admin` role only)
- **Responses:**
  - `200 OK`: `{ "message": "Task deleted successfully" }`
  - `403 Forbidden`: `{ "detail": "Only administrators can delete tasks" }`

---

## 5. Team Members Endpoints

### 5.1 List Workspace Members
- **Endpoint:** `GET /api/v1/members`
- **Authentication:** Required
- **Responses:**
  - `200 OK`: List of `User` objects (passwords stripped)

### 5.2 Invite Member
- **Endpoint:** `POST /api/v1/members/invite`
- **Authentication:** Required (`admin` role only)
- **Request Body:**
  ```json
  {
    "name": "Alex Chen",
    "email": "alex@company.com",
    "designation": "Frontend Specialist",
    "joiningDate": "2026-11-01"
  }
  ```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "member": {
        "id": "new-user-uuid",
        "name": "Alex Chen",
        "email": "alex@company.com",
        "role": "member",
        "status": "active",
        "designation": "Frontend Specialist",
        "joiningDate": "2026-11-01",
        "requiresPasswordChange": true
      },
      "temporaryPassword": "p$K9#mQ2!vL8"
    }
    ```
  - `409 Conflict`: `{ "detail": "A user with this email already exists" }`
  - `403 Forbidden`: Non-admin access

### 5.3 Update Member Profile
- **Endpoint:** `PATCH /api/v1/members/{id}`
- **Authentication:** Required (Admin can update all; Member can update own profile)
- **Request Body:**
  ```json
  {
    "name": "Alex Chen",
    "designation": "Staff Frontend Specialist"
  }
  ```
- **Responses:**
  - `200 OK`: Updated user profile

### 5.4 Delete Member
- **Endpoint:** `DELETE /api/v1/members/{id}`
- **Authentication:** Required (`admin` role only)
- **Responses:**
  - `200 OK`: `{ "message": "Member removed successfully" }`
  - `403 Forbidden`: Non-admin access
