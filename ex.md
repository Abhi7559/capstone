# **TeamHub API Specification & QA Documentation**

### **Base URL:** `https://teamhub-backend-p5a1.onrender.com/task_management/api/v1`

---

### **Credentials**
* **System Administrator:**
  * **Email:** `admin@teamboard.com`
  * **Password:** `Admin@123`
* **Workspace Member:**
  * **Email:** `alex.mercer@company.com` (or `member@teamboard.com`)
  * **Password:** `Member@123`

---

### **Database Connection**
* **Host:** `postgresql://teamhub_vj36_user:bvBLm7q49dlLVmOZdXQ7edLUpsOONPOB@dpg-dbi6hb6tlv9c7390ga9g-a.oregon-postgres.render.com/teamhub_vj36`
* **User:** `teamhub_vj36_user`
* **Password:** `bvBLm7q49dlLVmOZdXQ7edLUpsOONPOB`
* **Database:** `teamhub_vj36`
* **Redis Connection:** `rediss://default:Ab2qAAIncDE4YWM4NDFhNDI1YzQ0MDYwYTI4MjEzMDYwNmI2ZTk5MnAxNTY3MTQ@handy-sawfish-56714.upstash.io:6379`

---

## **📌 Standardized Response Models**

### **Standard Success Response (`200 OK` / `201 Created`)**
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... }
}
```

### **Standard Error Response (`400`, `401`, `403`, `404`, `409`, `500`)**
```json
{
  "status_code": 401,
  "success": false,
  "message": "Unauthorized",
  "detail": "Authorization credentials missing or invalid.",
  "error": {
    "code": "UNAUTHORIZED"
  }
}
```

### **Validation Error (`422 Unprocessable Entity`)**
```json
{
  "status_code": 422,
  "success": false,
  "message": "Validation Error",
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "password"],
      "msg": "String should have at least 8 characters",
      "input": "123"
    }
  ],
  "error": {
    "code": "REQUEST_VALIDATION_ERROR",
    "details": {
      "invalid_fields": ["password"]
    }
  }
}
```

---

## **Router 1: Authentication (`/auth`) — 6 Endpoints**

### **1. `POST /task_management/api/v1/auth/login`**
* **Purpose:** Authenticates user credentials using email and bcrypt-hashed password, issues a short-lived JWT access token (15 minutes) and long-lived refresh token (7 days). User profile details are decoupled and retrieved via `GET /auth/me`.
* **Scoping & RBAC:**
  * **Access:** Public (No Authorization header required).
  * **Status Check:** Rejects inactive accounts with `401 Unauthorized`.
* **Headers:** `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
```json
{
  "email": "admin@teamboard.com",
  "password": "Admin@123"
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImFkbWluQHRlYW1ib2FyZC5jb20iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTM0NTYwMDB9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NDAwMDAwMH0...",
  "tokenType": "Bearer",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized (`Invalid credentials`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Invalid email or password.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```
  * **HTTP 401 Unauthorized (`Inactive user`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Account is inactive or pending activation.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```
  * **HTTP 422 Unprocessable Entity (`Invalid email format`):**
  ```json
  {
    "status_code": 422,
    "success": false,
    "message": "Validation Error",
    "detail": [
      {
        "type": "value_error",
        "loc": ["body", "email"],
        "msg": "value is not a valid email address"
      }
    ],
    "error": {
      "code": "REQUEST_VALIDATION_ERROR",
      "details": {
        "invalid_fields": ["email"]
      }
    }
  }
  ```

---

### **2. `PATCH /task_management/api/v1/auth/change-password`**
* **Purpose:** Rotates an authenticated user's password. Verifies existing `currentPassword`, validates `newPassword`, updates bcrypt hash in database, and clears mandatory rotation flag (`requiresPasswordChange = false`).
* **Scoping & RBAC:** Protected. Requires valid access token. Accessible to all roles, including pending onboarding users.
* **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
```json
{
  "currentPassword": "TempPassword123!",
  "newPassword": "NewSecurePassword456!",
  "confirmPassword": "NewSecurePassword456!"
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "message": "Password updated successfully",
  "user": {
    "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    "email": "alex.mercer@company.com",
    "name": "Alex Mercer",
    "role": "member",
    "status": "active",
    "designation": "Senior Backend Engineer",
    "requiresPasswordChange": false,
    "joiningDate": "2026-11-01"
  }
}
```
* **Negative Scenarios:**
  * **HTTP 400 Bad Request (`Passwords do not match`):**
  ```json
  {
    "status_code": 400,
    "success": false,
    "message": "Bad Request",
    "detail": "New password and confirmation password do not match.",
    "error": {
      "code": "VALIDATION_ERROR"
    }
  }
  ```
  * **HTTP 401 Unauthorized (`Incorrect current password`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Current password is incorrect.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```
  * **HTTP 422 Unprocessable Entity (`Password too short`):**
  ```json
  {
    "status_code": 422,
    "success": false,
    "message": "Validation Error",
    "detail": [
      {
        "type": "string_too_short",
        "loc": ["body", "newPassword"],
        "msg": "String should have at least 8 characters"
      }
    ],
    "error": {
      "code": "REQUEST_VALIDATION_ERROR",
      "details": {
        "invalid_fields": ["newPassword"]
      }
    }
  }
  ```

---

### **3. `POST /task_management/api/v1/auth/signup`**
* **Purpose:** Activates an invited user's account and sets their initial permanent password using the signed invitation token.
* **Scoping & RBAC:** Public. Validated by cryptographic signature of invitation token.
* **Headers:** `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
```json
{
  "email": "alex.mercer@company.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNzMzZTE2OS00OWQ0LTRkNjYtYjRlZi0yNDYwZGE3YTNhMzAiLCJlbWFpbCI6ImFsZXgubWVyY2VyQGNvbXBhbnkuY29tIiwiZXhwIjoxNzkzNjI4ODAwfQ...",
  "newPassword": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "message": "Account activated and password set successfully",
  "user": {
    "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    "email": "alex.mercer@company.com",
    "name": "Alex Mercer",
    "role": "member",
    "status": "active",
    "designation": "Senior Backend Engineer",
    "requiresPasswordChange": false,
    "joiningDate": "2026-11-01"
  }
}
```
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized (`Invalid or expired token`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Invalid or expired invitation link.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```
  * **HTTP 404 Not Found (`User not found`):**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "User not found",
    "detail": "User with identifier 'alex.mercer@company.com' not found.",
    "error": {
      "code": "USER_NOT_FOUND",
      "details": {
        "entity": "User",
        "identifier": "alex.mercer@company.com"
      }
    }
  }
  ```

---

### **4. `POST /task_management/api/v1/auth/refresh`**
* **Purpose:** Exchanges a valid refresh token for a newly signed 15-minute access token and rotated refresh token.
* **Scoping & RBAC:** Public (Token based).
* **Headers:** `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NDAwMDAwMH0..."
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImFkbWluQHRlYW1ib2FyZC5jb20iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTM0NTY5MDB9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new.rotated.token...",
  "tokenType": "Bearer",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized (`Revoked or expired refresh token`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Refresh token is invalid, expired, or revoked.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```

---

### **5. `POST /task_management/api/v1/auth/logout`**
* **Purpose:** Revokes current session by blacklisting the active access token in Redis and revoking the refresh token.
* **Scoping & RBAC:** Protected. Requires valid access token.
* **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body (Optional):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "message": "Logged out successfully"
}
```
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized (`Missing credentials`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Authorization credentials missing or invalid.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```

---

### **6. `GET /task_management/api/v1/auth/me`**
* **Purpose:** Retrieves authenticated user's profile details, role, status, designation, and deterministic DiceBear avatar URL.
* **Scoping & RBAC:** Protected. Accessible to any authenticated user.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:** None
* **Positive Response Scenario A (When Called by Admin — `200 OK`):**
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
* **Positive Response Scenario B (When Called by Member — `200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized (`Invalid token`):**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Authorization credentials missing or invalid.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```
  * **HTTP 403 Forbidden (`Password change required`):**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Password Change Required",
    "detail": "Password change required before accessing this resource.",
    "error": {
      "code": "PASSWORD_CHANGE_REQUIRED"
    }
  }
  ```

---

## **Router 2: Projects & Dynamic Kanban Columns (`/projects`) — 10 Endpoints**

### **7. `GET /task_management/api/v1/projects`**
* **Purpose:** Retrieves projects visible to current user. Dual-mode response formatting: returns paginated envelope when pagination parameters are provided, or flat list for dashboards.
* **Scoping & RBAC:**
  * **Admin:** Returns all projects across workspace.
  * **Member:** Scoped to projects where user is assigned in `project_members`.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:** None
* **Query Parameters:**
  * `page` (integer, optional, $\ge 1$) — Page number (1-based index).
  * `pageSize` (integer, optional, $1 \le pageSize \le 100$, default: 12) — Items per page.
  * `status` (string, optional: `planning`, `active`, `paused`, `completed`, `cancelled`)
  * `category` (string, optional: `Engineering`, `Product Design`, `Marketing & Brand`, `Operations`, `Security & Compliance`)
  * `search` (string, optional) — Filter by project name.
* **Positive Response Scenario A (With Pagination — `?page=1&pageSize=2` — `200 OK`):**
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
      "createdBy": "550e8400-e29b-41d4-a716-446655440000",
      "members": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "System Admin",
          "email": "admin@teamboard.com",
          "role": "admin"
        },
        {
          "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
          "name": "Alex Mercer",
          "email": "alex.mercer@company.com",
          "role": "member"
        }
      ],
      "createdAt": "2026-10-30T06:00:00Z",
      "updatedAt": "2026-10-30T06:00:00Z"
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
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized:**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Authorization credentials missing or invalid.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```
  * **HTTP 422 Unprocessable Entity (`Invalid page query`):**
  ```json
  {
    "status_code": 422,
    "success": false,
    "message": "Validation Error",
    "detail": [
      {
        "type": "greater_than_equal",
        "loc": ["query", "page"],
        "msg": "Input should be greater than or equal to 1"
      }
    ],
    "error": {
      "code": "REQUEST_VALIDATION_ERROR",
      "details": {
        "invalid_fields": ["page"]
      }
    }
  }
  ```

---

### **8. `POST /task_management/api/v1/projects`**
* **Purpose:** Creates a new project in the workspace, verifies dates and category, and assigns initial members.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
```json
{
  "name": "Cloud Infrastructure Migration",
  "description": "Migrate compute nodes to microservices on GCP.",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-15",
  "members": [
    "550e8400-e29b-41d4-a716-446655440000",
    "b733e169-49d4-4d66-b4ef-2460da7a3a30"
  ]
}
```
* **Positive Response Scenario (`201 Created`):**
```json
{
  "id": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
  "name": "Cloud Infrastructure Migration",
  "description": "Migrate compute nodes to microservices on GCP.",
  "status": "planning",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-15",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "System Admin",
      "email": "admin@teamboard.com",
      "role": "admin"
    },
    {
      "id": "b733e169-49d4-4d66-b4ef-2460da7a3a30",
      "name": "Alex Mercer",
      "email": "alex.mercer@company.com",
      "role": "member"
    }
  ],
  "createdAt": "2026-10-30T10:00:00Z",
  "updatedAt": "2026-10-30T10:00:00Z"
}
```
* **Negative Scenarios:**
  * **HTTP 400 Bad Request (`Invalid dates`):**
  ```json
  {
    "status_code": 400,
    "success": false,
    "message": "Bad Request",
    "detail": "End date cannot be earlier than start date.",
    "error": {
      "code": "VALIDATION_ERROR"
    }
  }
  ```
  * **HTTP 403 Forbidden (`Non-admin caller`):**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Forbidden: Only Admins can create projects.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```

---

### **9. `GET /task_management/api/v1/projects/{id}`**
* **Purpose:** Retrieves full details of a specific project and its assigned members.
* **Scoping & RBAC:**
  * **Admin:** Permitted for all workspace projects.
  * **Member:** Permitted only if assigned to the project.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Positive Response Scenario (`200 OK`):**
```json
{
  "id": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
  "name": "Cloud Infrastructure Migration",
  "description": "Migrate compute nodes to microservices on GCP.",
  "status": "planning",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-15",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "System Admin",
      "email": "admin@teamboard.com",
      "role": "admin"
    }
  ],
  "createdAt": "2026-10-30T10:00:00Z",
  "updatedAt": "2026-10-30T10:00:00Z"
}
```
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "You do not have permission to view this project.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f"
      }
    }
  }
  ```

---

### **10. `PATCH /task_management/api/v1/projects/{id}`**
* **Purpose:** Updates project metadata, status, member assignments, or dates. Automatically updates `updatedAt` and invalidates cached analytics.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Request Body:**
```json
{
  "status": "active",
  "description": "Updated infrastructure roadmap."
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "id": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f",
  "name": "Cloud Infrastructure Migration",
  "description": "Updated infrastructure roadmap.",
  "status": "active",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-15",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "System Admin",
      "email": "admin@teamboard.com",
      "role": "admin"
    }
  ],
  "createdAt": "2026-10-30T10:00:00Z",
  "updatedAt": "2026-10-30T17:30:00Z"
}
```
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Forbidden: Only Admins can update projects.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f"
      }
    }
  }
  ```

---

### **11. `DELETE /task_management/api/v1/projects/{id}`**
* **Purpose:** Soft-deletes a project and sets `is_deleted = true`.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Positive Response Scenario (`200 OK`):**
```json
{
  "success": true,
  "message": "Project deleted successfully."
}
```
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Forbidden: Only Admins can delete projects.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f"
      }
    }
  }
  ```

---

### **12. `GET /task_management/api/v1/projects/{id}/activities`**
* **Purpose:** Returns the chronological audit activity feed for a project.
* **Scoping & RBAC:** Accessible to Admins and assigned project members.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Positive Response Scenario (`200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "You do not have access to this project's activities.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f"
      }
    }
  }
  ```

---

### **13. `GET /task_management/api/v1/projects/{id}/columns`**
* **Purpose:** Retrieves the list of active Kanban columns configured for a project.
* **Scoping & RBAC:** Accessible to Admins and assigned project members.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Positive Response Scenario (`200 OK`):**
```json
[
  {
    "id": "backlog",
    "name": "Backlog",
    "slug": "backlog",
    "order": 0,
    "color": "#94A3B8",
    "taskCount": 2
  },
  {
    "id": "todo",
    "name": "To Do",
    "slug": "todo",
    "order": 1,
    "color": "#6366F1",
    "taskCount": 5
  },
  {
    "id": "in_progress",
    "name": "In Progress",
    "slug": "in_progress",
    "order": 2,
    "color": "#3B82F6",
    "taskCount": 4
  },
  {
    "id": "done",
    "name": "Done",
    "slug": "done",
    "order": 3,
    "color": "#22C55E",
    "taskCount": 7
  }
]
```
* **Negative Scenarios:**
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f"
      }
    }
  }
  ```

---

### **14. `POST /task_management/api/v1/projects/{id}/columns`**
* **Purpose:** Adds a custom Kanban column to an existing project.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Request Body:**
```json
{
  "name": "QA Testing",
  "color": "#8B5CF6"
}
```
* **Positive Response Scenario (`201 Created`):**
```json
{
  "id": "qa_testing",
  "name": "QA Testing",
  "slug": "qa_testing",
  "order": 4,
  "color": "#8B5CF6",
  "taskCount": 0
}
```
* **Negative Scenarios:**
  * **HTTP 409 Conflict (`Duplicate column name`):**
  ```json
  {
    "status_code": 409,
    "success": false,
    "message": "Conflict",
    "detail": "A column with this name or slug already exists in this project.",
    "error": {
      "code": "DUPLICATE_ENTITY"
    }
  }
  ```

---

### **15. `PUT /task_management/api/v1/projects/{id}/columns/reorder`**
* **Purpose:** Reorders columns in a project and persists new display sequence.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
* **Request Body:**
```json
{
  "columnIds": ["backlog", "todo", "qa_testing", "in_progress", "done"]
}
```
* **Positive Response Scenario (`200 OK`):**
```json
[
  { "id": "backlog", "name": "Backlog", "slug": "backlog", "order": 0, "color": "#94A3B8" },
  { "id": "todo", "name": "To Do", "slug": "todo", "order": 1, "color": "#6366F1" },
  { "id": "qa_testing", "name": "QA Testing", "slug": "qa_testing", "order": 2, "color": "#8B5CF6" },
  { "id": "in_progress", "name": "In Progress", "slug": "in_progress", "order": 3, "color": "#3B82F6" },
  { "id": "done", "name": "Done", "slug": "done", "order": 4, "color": "#22C55E" }
]
```
* **Negative Scenarios:**
  * **HTTP 400 Bad Request:**
  ```json
  {
    "status_code": 400,
    "success": false,
    "message": "Bad Request",
    "detail": "Invalid column ordering payload.",
    "error": {
      "code": "VALIDATION_ERROR"
    }
  }
  ```

---

### **16. `DELETE /task_management/api/v1/projects/{id}/columns/{column_id}`**
* **Purpose:** Deletes a Kanban column from a project and safely cascades tasks back to default column.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Project UUID identifier.
  * `column_id` (string, required) — Column slug or identifier.
* **Positive Response Scenario (`200 OK`):**
```json
{
  "success": true,
  "message": "Column deleted successfully."
}
```
* **Negative Scenarios:**
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Column not found",
    "detail": "Column with identifier 'qa_testing' not found.",
    "error": {
      "code": "COLUMN_NOT_FOUND",
      "details": {
        "entity": "Column",
        "identifier": "qa_testing"
      }
    }
  }
  ```

---

## **Router 3: Tasks (`/tasks`) — 6 Endpoints**

### **17. `GET /task_management/api/v1/tasks`**
* **Purpose:** Retrieves filtered and paginated tasks. Returns paginated envelope when pagination parameters are provided, or flat list for Kanban boards.
* **Scoping & RBAC:**
  * **Admin:** Queries tasks across all projects and members.
  * **Member:** Scoped to tasks belonging to projects where user is assigned.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:** None
* **Query Parameters (8 Official Swagger Parameters):**
  * `page` (integer, optional, $\ge 1$) — Page number (1-based).
  * `pageSize` (integer, optional, $1 \le pageSize \le 100$, default: 20) — Items per page.
  * `projectId` (UUID, optional) — Filter by project UUID.
  * `status` (string, optional: `todo`, `in_progress`, `review`, `done`)
  * `priority` (string, optional: `low`, `medium`, `high`)
  * `assigneeId` (UUID, optional) — Filter by assigned member UUID.
  * `dueDate` (date string `YYYY-MM-DD`, optional) — Filter by target due date.
  * `tag` (string, optional) — Filter tasks containing this tag.
* **Positive Response Scenario A (With Pagination — `?page=1&pageSize=1` — `200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized:**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Authorization credentials missing or invalid.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```

---

### **18. `POST /task_management/api/v1/tasks`**
* **Purpose:** Creates a new task within a specified project. Enforces referential integrity by verifying project exists and that `assigneeId` is an active project member.
* **Scoping & RBAC:**
  * **Admin:** Can create tasks in any project.
  * **Member:** Can create tasks only in projects they belong to.
* **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
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
* **Positive Response Scenario (`201 Created`):**
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
* **Negative Scenarios:**
  * **HTTP 400 Bad Request (`Assignee not a member`):**
  ```json
  {
    "status_code": 400,
    "success": false,
    "message": "Bad Request",
    "detail": "Assignee is not a member of this project",
    "error": {
      "code": "VALIDATION_ERROR"
    }
  }
  ```
  * **HTTP 404 Not Found (`Project not found`):**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "8d3e2a10-2b1c-4e3f-9a1b-1a2b3c4d5e6f"
      }
    }
  }
  ```

---

### **19. `GET /task_management/api/v1/tasks/{id}`**
* **Purpose:** Retrieves full details of an individual task by unique identifier.
* **Scoping & RBAC:**
  * **Admin:** Can view any task.
  * **Member:** Permitted only if assigned to task's project.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Task UUID identifier.
* **Positive Response Scenario (`200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Task not found",
    "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found.",
    "error": {
      "code": "TASK_NOT_FOUND",
      "details": {
        "entity": "Task",
        "identifier": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f"
      }
    }
  }
  ```

---

### **20. `PATCH /task_management/api/v1/tasks/{id}`**
* **Purpose:** Partially updates task fields (status, priority, assignee, due date, description). Automatically writes audit entry to `project_activities` on status change and clears Redis caches.
* **Scoping & RBAC:** Admin or assigned project member.
* **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
* **Path Parameters:**
  * `id` (UUID, required) — Task UUID identifier.
* **Request Body:**
```json
{
  "status": "in_progress"
}
```
* **Positive Response Scenario (`200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "You do not have permission to update this task.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Task not found",
    "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found.",
    "error": {
      "code": "TASK_NOT_FOUND",
      "details": {
        "entity": "Task",
        "identifier": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f"
      }
    }
  }
  ```

---

### **21. `DELETE /task_management/api/v1/tasks/{id}`**
* **Purpose:** Soft-deletes a task (`is_deleted = true`).
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Task UUID identifier.
* **Positive Response Scenario (`200 OK`):**
```json
{
  "success": true,
  "message": "Task deleted successfully."
}
```
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Forbidden: Only Admins can delete tasks.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Task not found",
    "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found.",
    "error": {
      "code": "TASK_NOT_FOUND",
      "details": {
        "entity": "Task",
        "identifier": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f"
      }
    }
  }
  ```

---

### **22. `POST /task_management/api/v1/tasks/{id}/restore`**
* **Purpose:** Restores a previously soft-deleted task (`is_deleted = false`).
* **Scoping & RBAC:** Admin only.
* **Headers:** `Authorization: Bearer <admin_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Task UUID identifier.
* **Positive Response Scenario (`200 OK`):**
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
  "updatedAt": "2026-10-30T12:00:00Z"
}
```
* **Negative Scenarios:**
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Task not found",
    "detail": "Task with identifier 'e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f' not found.",
    "error": {
      "code": "TASK_NOT_FOUND",
      "details": {
        "entity": "Task",
        "identifier": "e9a78123-5c6d-4b8a-9e12-3a4b5c6d7e8f"
      }
    }
  }
  ```

---

## **Router 4: Members (`/members`) — 5 Endpoints**

### **23. `GET /task_management/api/v1/members`**
* **Purpose:** Retrieves all active workspace members. Password hashes are excluded.
* **Scoping & RBAC:** Protected. Accessible to any authenticated user.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:** None
* **Query Parameters:** None
* **Positive Response Scenario (`200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized:**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Authorization credentials missing or invalid.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```

---

### **24. `POST /task_management/api/v1/members/invite`**
* **Purpose:** Admin creates a new member account with `requiresPasswordChange = true`, generates signed invitation token (valid for 3 days), renders email template, and queues invitation email via FastAPI `BackgroundTasks`.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
* **Path Parameters:** None
* **Query Parameters:** None
* **Request Body:**
```json
{
  "name": "Sarah Connor",
  "email": "sarah.connor@company.com",
  "designation": "Staff DevOps Architect",
  "joiningDate": "2026-11-15"
}
```
* **Positive Response Scenario (`201 Created`):**
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
  "signupUrl": "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app/signup?email=sarah.connor@company.com&token=eyJhbGciOiJIUzI1Ni..."
}
```
* **Negative Scenarios:**
  * **HTTP 409 Conflict (`Email already registered`):**
  ```json
  {
    "status_code": 409,
    "success": false,
    "message": "Conflict",
    "detail": "A user with this email already exists",
    "error": {
      "code": "DUPLICATE_ENTITY"
    }
  }
  ```
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Forbidden: insufficient role permissions",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```

---

### **25. `POST /task_management/api/v1/members/{id}/resend-invite`**
* **Purpose:** Re-generates a signed activation token and dispatches fresh invitation email to an onboarded member.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Member UUID identifier.
* **Positive Response Scenario (`200 OK`):**
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
  "invitationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "signupUrl": "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app/signup?email=sarah.connor@company.com&token=eyJhbGciOiJIUzI1Ni..."
}
```
* **Negative Scenarios:**
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Member not found",
    "detail": "Member with identifier 'c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22' not found.",
    "error": {
      "code": "MEMBER_NOT_FOUND",
      "details": {
        "entity": "Member",
        "identifier": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22"
      }
    }
  }
  ```

---

### **26. `PATCH /task_management/api/v1/members/{id}`**
* **Purpose:** Updates member profile information (name, designation, role, status, or password).
* **Scoping & RBAC:**
  * **Admin:** Can update any member profile, designation, or role.
  * **Member:** Can only update self; cannot modify role or status (`403 Forbidden`).
* **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
* **Path Parameters:**
  * `id` (UUID, required) — Member UUID identifier.
* **Request Body:**
```json
{
  "name": "Sarah Connor",
  "designation": "Principal Site Reliability Engineer"
}
```
* **Positive Response Scenario (`200 OK`):**
```json
{
  "id": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22",
  "name": "Sarah Connor",
  "email": "sarah.connor@company.com",
  "role": "member",
  "designation": "Principal Site Reliability Engineer",
  "joiningDate": "2026-11-15",
  "status": "active",
  "requiresPasswordChange": false
}
```
* **Negative Scenarios:**
  * **HTTP 403 Forbidden (`Member attempting to modify role`):**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Only administrators can modify user roles.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Member not found",
    "detail": "Member with identifier 'c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22' not found.",
    "error": {
      "code": "MEMBER_NOT_FOUND",
      "details": {
        "entity": "Member",
        "identifier": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22"
      }
    }
  }
  ```

---

### **27. `DELETE /task_management/api/v1/members/{id}`**
* **Purpose:** Safely removes a member from workspace, unassigns their tasks, and protects the last remaining admin.
* **Scoping & RBAC:** Admin only. Non-admin callers receive `403 Forbidden`.
* **Headers:** `Authorization: Bearer <admin_token>`
* **Path Parameters:**
  * `id` (UUID, required) — Member UUID identifier.
* **Positive Response Scenario (`200 OK`):**
```json
{
  "success": true,
  "message": "Member deleted successfully."
}
```
* **Negative Scenarios:**
  * **HTTP 400 Bad Request (`Cannot delete last admin`):**
  ```json
  {
    "status_code": 400,
    "success": false,
    "message": "Bad Request",
    "detail": "Cannot delete the last remaining organization administrator.",
    "error": {
      "code": "CANNOT_DELETE_LAST_ADMIN"
    }
  }
  ```
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "Only administrators can delete members.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Member not found",
    "detail": "Member with identifier 'c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22' not found.",
    "error": {
      "code": "MEMBER_NOT_FOUND",
      "details": {
        "entity": "Member",
        "identifier": "c1f7b889-1d2e-4bb8-8c1d-1bb2bd380b22"
      }
    }
  }
  ```

---

## **Router 5: Dashboard & Analytics (`/dashboard`, `/analytics`) — 2 Endpoints**

### **28. `GET /task_management/api/v1/dashboard/stats`**
* **Purpose:** Computes role-specific overview KPIs, status counters, and workload metrics with Redis caching (TTL: 60s).
* **Scoping & RBAC:**
  * **Admin:** Workspace-wide aggregates across all projects.
  * **Member:** Scoped strictly to assigned projects and tasks.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:** None
* **Query Parameters:** None
* **Positive Response Scenario A (When Called by Admin — Global Scope — `200 OK`):**
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
* **Positive Response Scenario B (When Called by Member — Assigned Scope — `200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 401 Unauthorized:**
  ```json
  {
    "status_code": 401,
    "success": false,
    "message": "Unauthorized",
    "detail": "Authorization credentials missing or invalid.",
    "error": {
      "code": "UNAUTHORIZED"
    }
  }
  ```

---

### **29. `GET /task_management/api/v1/analytics/data`**
* **Purpose:** Pre-aggregates status distribution, member workloads, and 7-day completion trajectories for Recharts visualizations (Redis TTL: 300s).
* **Scoping & RBAC:**
  * **Admin:** Aggregates workspace-wide or scoped to `projectId`.
  * **Member:** Scoped to assigned projects; querying unassigned projects returns `403 Forbidden`.
* **Headers:** `Authorization: Bearer <access_token>`
* **Path Parameters:** None
* **Query Parameters:**
  * `projectId` (UUID, optional) — Filter analytics dataset to single project.
* **Positive Response Scenario (`200 OK`):**
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
* **Negative Scenarios:**
  * **HTTP 403 Forbidden:**
  ```json
  {
    "status_code": 403,
    "success": false,
    "message": "Forbidden",
    "detail": "You do not have access to view analytics for this project.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
  * **HTTP 404 Not Found:**
  ```json
  {
    "status_code": 404,
    "success": false,
    "message": "Project not found",
    "detail": "Project with identifier '98084b00-fca4-4191-8a33-aa2c51596b4b' not found.",
    "error": {
      "code": "PROJECT_NOT_FOUND",
      "details": {
        "entity": "Project",
        "identifier": "98084b00-fca4-4191-8a33-aa2c51596b4b"
      }
    }
  }
  ```
  * **HTTP 422 Unprocessable Entity (`Invalid UUID`):**
  ```json
  {
    "status_code": 422,
    "success": false,
    "message": "Validation Error",
    "detail": [
      {
        "type": "uuid_parsing",
        "loc": ["query", "projectId"],
        "msg": "Input should be a valid UUID"
      }
    ],
    "error": {
      "code": "REQUEST_VALIDATION_ERROR",
      "details": {
        "invalid_fields": ["projectId"]
      }
    }
  }
  ```

---

## **Router 6: HTMX Server-Rendered Components (`/htmx`) — 2 Endpoints**

### **30. `GET /htmx/dashboard`**
* **Purpose:** Renders full server-side HTML dashboard interface using Jinja2 templates (`templates/dashboard_page.html`) styled with Tailwind CSS and live HTMX polling attributes (`hx-get="/htmx/dashboard/stats"`, `hx-trigger="every 30s"`).
* **Scoping & RBAC:** Public/Flexible (resolves Bearer token, `?token=` parameter, developer headers, or falls back to admin for browser viewing).
* **Headers:** `Authorization: Bearer <access_token>` (optional if `?token=` passed)
* **Path Parameters:** None
* **Query Parameters:**
  * `token` (string, optional) — JWT access token.
* **Positive Response Scenario (`200 OK` — `Content-Type: text/html; charset=utf-8`):**
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
    <section id="kpi-stats-container" hx-get="/htmx/dashboard/stats" hx-trigger="every 30s" hx-swap="innerHTML">
    </section>
  </main>
</body>
</html>
```

---

### **31. `GET /htmx/dashboard/stats`**
* **Purpose:** Generates lightweight HTML partial fragment containing real-time KPI metric cards (`templates/dashboard_stats_fragment.html`), polled automatically every 30s by HTMX from Redis cache (TTL: 60s).
* **Scoping & RBAC:** Accessible via token in header or query parameter.
* **Positive Response Scenario (`200 OK` — `Content-Type: text/html; charset=utf-8`):**
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

---

## **Router 7: Operational Health Probe (`/health`) — 1 Endpoint**

### **32. `GET /task_management/api/v1/health`**
* **Purpose:** Operational readiness and liveness probe testing PostgreSQL and Redis connections.
* **Scoping & RBAC:** Public (No authorization required).
* **Headers:** None
* **Path Parameters:** None
* **Query Parameters:** None
* **Positive Response Scenario (`200 OK`):**
```json
{
  "status": "healthy",
  "timestamp": "2026-11-02T08:00:00.000000+00:00",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```
* **Negative Scenario (`503 Service Unavailable`):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-11-02T08:00:00.000000+00:00",
  "services": {
    "database": "disconnected",
    "redis": "connected"
  }
}
```
