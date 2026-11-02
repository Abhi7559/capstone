# **TeamHub API Specification & QA Documentation**

### **Base URL:** `https://teamhub-backend-p5a1.onrender.com/task_management/api/v1`

### **Default Credentials**
* **System Administrator:** `admin@teamboard.com` / `Admin@123`
* **Workspace Member:** `member@teamboard.com` / `Member@123`

---

## **📌 Standard Response Models**

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

## **1. System & Health (1 Route)**

### **1. `GET /health`**

* **Summary:** Health check & service liveness probe for PostgreSQL and Redis.
* **Access:** Public

#### **✅ Positive Scenario (`200 OK`)**

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

#### **❌ Negative Scenario (`503 Service Unavailable`)**

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

---

## **2. Authentication (6 Routes)**

### **2. `POST /auth/login`**

* **Summary:** Authenticate user credentials and return JWT tokens (Decoupled profile; profile retrieved via `GET /auth/me`).
* **Access:** Public

#### **Request Body**

```json
{
  "email": "admin@teamboard.com",
  "password": "Admin@123"
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImFkbWluQHRlYW1ib2FyZC5jb20iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3OTM0NTYwMDB9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NDAwMDAwMH0...",
  "tokenType": "Bearer",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

---

### **3. `GET /auth/me`**

* **Summary:** Fetch profile information and avatar for authenticated user.
* **Access:** Authenticated

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@teamboard.com",
  "name": "System Admin",
  "role": "admin",
  "status": "active",
  "designation": "System Administrator",
  "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=System%20Admin",
  "createdAt": "2026-10-15T09:00:00Z"
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

### **4. `POST /auth/refresh`**

* **Summary:** Exchange valid refresh token for rotated access & refresh tokens.
* **Access:** Public (Token based)

#### **Request Body**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
  "tokenType": "Bearer",
  "accessTokenExpiresIn": 900,
  "refreshTokenExpiresIn": 604800
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

### **5. `PATCH /auth/change-password`**

* **Summary:** Update user password and clear forced password rotation flag.
* **Access:** Authenticated (Allows pending user)

#### **Request Body**

```json
{
  "currentPassword": "Admin@123",
  "newPassword": "NewAdminPassword@456"
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "message": "Password updated successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@teamboard.com",
    "name": "System Admin",
    "role": "admin",
    "status": "active",
    "designation": "System Administrator",
    "requiresPasswordChange": false,
    "joiningDate": "2026-09-01"
  }
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

---

### **6. `POST /auth/signup`**

* **Summary:** Invited member activates account and sets initial password using invitation token.
* **Access:** Public

#### **Request Body**

```json
{
  "email": "sarah.connor@teamboard.com",
  "token": "inv_3f82901ab8e04b901928374a",
  "newPassword": "NewMemberPassword@123"
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "message": "Account activated and password set successfully",
  "user": {
    "id": "987fcdeb-51a2-43d7-9012-345678901234",
    "email": "sarah.connor@teamboard.com",
    "name": "Sarah Connor",
    "role": "member",
    "status": "active",
    "designation": "Software Engineer",
    "requiresPasswordChange": false,
    "joiningDate": "2026-11-01"
  }
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

---

### **7. `POST /auth/logout`**

* **Summary:** Revoke refresh token and blacklist access token in Redis.
* **Access:** Authenticated

#### **Request Body (Optional)**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "message": "Logged out successfully"
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

## **3. Workspace Members (4 Routes)**

### **8. `GET /members`**

* **Summary:** Retrieve all active workspace members.
* **Access:** Authenticated

#### **✅ Positive Scenario (`200 OK`)**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@teamboard.com",
    "name": "System Admin",
    "role": "admin",
    "status": "active",
    "designation": "System Administrator",
    "requiresPasswordChange": false,
    "joiningDate": "2026-09-01"
  },
  {
    "id": "987fcdeb-51a2-43d7-9012-345678901234",
    "email": "sarah.connor@teamboard.com",
    "name": "Sarah Connor",
    "role": "member",
    "status": "active",
    "designation": "Software Engineer",
    "requiresPasswordChange": false,
    "joiningDate": "2026-10-20"
  }
]
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

### **9. `POST /members/invite`**

* **Summary:** Admin invites a new member account and sends welcome email with onboarding link.
* **Access:** Admin only

#### **Request Body**

```json
{
  "name": "John Doe",
  "email": "john.doe@teamboard.com",
  "role": "member",
  "designation": "Backend Developer",
  "joiningDate": "2026-11-05"
}
```

#### **✅ Positive Scenario (`201 Created`)**

```json
{
  "message": "Invitation sent successfully",
  "member": {
    "id": "456e789a-12b3-44c5-d678-901234567890",
    "email": "john.doe@teamboard.com",
    "name": "John Doe",
    "role": "member",
    "status": "active",
    "designation": "Backend Developer",
    "requiresPasswordChange": true,
    "joiningDate": "2026-11-05"
  },
  "invitationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "signupUrl": "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app/signup?email=john.doe@teamboard.com&token=eyJhbGciOiJIUzI1Ni..."
}
```

#### **❌ Negative Scenario (`409 Conflict`)**

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

---

### **10. `PATCH /members/{id}`**

* **Summary:** Update member profile details or role (Admin updates all; Member updates self).
* **Access:** Authenticated

#### **Path Parameters**
* `id` (UUID): Member user identifier.

#### **Request Body**

```json
{
  "name": "Jonathan Doe",
  "designation": "Senior Backend Developer"
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "456e789a-12b3-44c5-d678-901234567890",
  "email": "john.doe@teamboard.com",
  "name": "Jonathan Doe",
  "role": "member",
  "status": "active",
  "designation": "Senior Backend Developer",
  "requiresPasswordChange": false,
  "joiningDate": "2026-11-05"
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Member not found",
  "detail": "Member with identifier '456e789a-12b3-44c5-d678-901234567890' not found.",
  "error": {
    "code": "MEMBER_NOT_FOUND",
    "details": {
      "entity": "Member",
      "identifier": "456e789a-12b3-44c5-d678-901234567890"
    }
  }
}
```

---

### **11. `DELETE /members/{id}`**

* **Summary:** Delete member account from workspace and protect last administrator.
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Member user identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "success": true,
  "message": "Member deleted successfully."
}
```

#### **❌ Negative Scenario (`403 Forbidden`)**

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

---

## **4. Projects (5 Routes)**

### **12. `GET /projects`**

* **Summary:** List projects accessible to current user (supports pagination & filtering).
* **Access:** Authenticated
* **Query Parameters:**
  * `page` (integer, default `1`)
  * `pageSize` (integer, default `12`)
  * `status` (string: `planning`, `active`, `paused`, `completed`, `cancelled`)
  * `category` (string: `Engineering`, `Product Design`, `Marketing & Brand`, `Operations`, `Security & Compliance`)
  * `search` (string)

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "items": [
    {
      "id": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
      "name": "Cloud Infrastructure Overhaul",
      "description": "Kubernetes migration and Redis cluster setup.",
      "status": "active",
      "category": "Engineering",
      "priority": "high",
      "startDate": "2026-11-01",
      "dueDate": "2026-12-31",
      "createdBy": "550e8400-e29b-41d4-a716-446655440000",
      "members": [
        {
          "id": "987fcdeb-51a2-43d7-9012-345678901234",
          "name": "Sarah Connor",
          "email": "sarah.connor@teamboard.com",
          "role": "member"
        }
      ],
      "createdAt": "2026-10-30T14:50:00Z",
      "updatedAt": "2026-10-30T14:50:00Z"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "page": 1,
    "pageSize": 12,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

### **13. `POST /projects`**

* **Summary:** Create a new project in the workspace.
* **Access:** Admin only

#### **Request Body**

```json
{
  "name": "Mobile Application v2",
  "description": "Flutter mobile client rewrite.",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-10",
  "dueDate": "2027-01-31",
  "members": ["987fcdeb-51a2-43d7-9012-345678901234"]
}
```

#### **✅ Positive Scenario (`201 Created`)**

```json
{
  "id": "5a4b3c2d-98e1-47fa-8910-123456789abc",
  "name": "Mobile Application v2",
  "description": "Flutter mobile client rewrite.",
  "status": "planning",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-10",
  "dueDate": "2027-01-31",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    {
      "id": "987fcdeb-51a2-43d7-9012-345678901234",
      "name": "Sarah Connor",
      "email": "sarah.connor@teamboard.com",
      "role": "member"
    }
  ],
  "createdAt": "2026-10-30T17:20:00Z",
  "updatedAt": "2026-10-30T17:20:00Z"
}
```

#### **❌ Negative Scenario (`403 Forbidden`)**

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

### **14. `GET /projects/{id}`**

* **Summary:** Fetch single project details.
* **Access:** Authenticated (Admins or assigned members)

#### **Path Parameters**
* `id` (UUID): Project identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "name": "Cloud Infrastructure Overhaul",
  "description": "Kubernetes migration and Redis cluster setup.",
  "status": "active",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-31",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    {
      "id": "987fcdeb-51a2-43d7-9012-345678901234",
      "name": "Sarah Connor",
      "email": "sarah.connor@teamboard.com",
      "role": "member"
    }
  ],
  "createdAt": "2026-10-30T14:50:00Z",
  "updatedAt": "2026-10-30T14:50:00Z"
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Project not found",
  "detail": "Project with identifier '2d8f99e0-1284-4fe1-9231-10c0828fe9aa' not found.",
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "details": {
      "entity": "Project",
      "identifier": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa"
    }
  }
}
```

---

### **15. `PATCH /projects/{id}`**

* **Summary:** Update project details, status, or member assignments.
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Project identifier.

#### **Request Body**

```json
{
  "status": "active",
  "description": "Updated roadmap description."
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "name": "Cloud Infrastructure Overhaul",
  "description": "Updated roadmap description.",
  "status": "active",
  "category": "Engineering",
  "priority": "high",
  "startDate": "2026-11-01",
  "dueDate": "2026-12-31",
  "createdBy": "550e8400-e29b-41d4-a716-446655440000",
  "members": [
    {
      "id": "987fcdeb-51a2-43d7-9012-345678901234",
      "name": "Sarah Connor",
      "email": "sarah.connor@teamboard.com",
      "role": "member"
    }
  ],
  "createdAt": "2026-10-30T14:50:00Z",
  "updatedAt": "2026-10-30T17:30:00Z"
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Project not found",
  "detail": "Project with identifier '2d8f99e0-1284-4fe1-9231-10c0828fe9aa' not found.",
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "details": {
      "entity": "Project",
      "identifier": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa"
    }
  }
}
```

---

### **16. `DELETE /projects/{id}`**

* **Summary:** Soft-delete a project (or cascade archive).
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Project identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "success": true,
  "message": "Project deleted successfully."
}
```

#### **❌ Negative Scenario (`403 Forbidden`)**

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

---

## **5. Project Kanban Columns (4 Routes)**

### **17. `GET /projects/{id}/columns`**

* **Summary:** Fetch Kanban columns configured for a project.
* **Access:** Authenticated

#### **Path Parameters**
* `id` (UUID): Project identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
[
  {
    "id": "c1a2b3c4-1111-2222-3333-444455556666",
    "name": "To Do",
    "slug": "todo",
    "order": 1,
    "color": "#6366F1",
    "taskCount": 4
  },
  {
    "id": "c2a2b3c4-1111-2222-3333-444455556666",
    "name": "In Progress",
    "slug": "in-progress",
    "order": 2,
    "color": "#F59E0B",
    "taskCount": 2
  },
  {
    "id": "c3a2b3c4-1111-2222-3333-444455556666",
    "name": "Completed",
    "slug": "completed",
    "order": 3,
    "color": "#10B981",
    "taskCount": 8
  }
]
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Project not found",
  "detail": "Project with identifier '2d8f99e0-1284-4fe1-9231-10c0828fe9aa' not found.",
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "details": {
      "entity": "Project",
      "identifier": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa"
    }
  }
}
```

---

### **18. `POST /projects/{id}/columns`**

* **Summary:** Add a new Kanban workflow column to a project.
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Project identifier.

#### **Request Body**

```json
{
  "name": "QA Review",
  "color": "#8B5CF6"
}
```

#### **✅ Positive Scenario (`201 Created`)**

```json
{
  "id": "c4a2b3c4-1111-2222-3333-444455556666",
  "name": "QA Review",
  "slug": "qa-review",
  "order": 4,
  "color": "#8B5CF6",
  "taskCount": 0
}
```

#### **❌ Negative Scenario (`409 Conflict`)**

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

### **19. `PATCH /projects/{id}/columns/{column_id}`**

* **Summary:** Rename column or update its color.
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Project identifier.
* `column_id` (UUID): Column identifier.

#### **Request Body**

```json
{
  "name": "In Review",
  "color": "#EC4899"
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "c4a2b3c4-1111-2222-3333-444455556666",
  "name": "In Review",
  "slug": "in-review",
  "order": 4,
  "color": "#EC4899",
  "taskCount": 0
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Column not found",
  "detail": "Column with identifier 'c4a2b3c4-1111-2222-3333-444455556666' not found.",
  "error": {
    "code": "COLUMN_NOT_FOUND",
    "details": {
      "entity": "Column",
      "identifier": "c4a2b3c4-1111-2222-3333-444455556666"
    }
  }
}
```

---

### **20. `DELETE /projects/{id}/columns/{column_id}`**

* **Summary:** Remove a Kanban column from a project.
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Project identifier.
* `column_id` (UUID): Column identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "success": true,
  "message": "Column deleted successfully."
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Column not found",
  "detail": "Column with identifier 'c4a2b3c4-1111-2222-3333-444455556666' not found.",
  "error": {
    "code": "COLUMN_NOT_FOUND",
    "details": {
      "entity": "Column",
      "identifier": "c4a2b3c4-1111-2222-3333-444455556666"
    }
  }
}
```

---

## **6. Tasks (6 Routes)**

### **21. `GET /tasks`**

* **Summary:** Retrieve filtered and paginated tasks.
* **Access:** Authenticated
* **Query Parameters (8 Official Swagger Parameters):**
  * `page` (integer, default `1`)
  * `pageSize` (integer, default `20`)
  * `projectId` (UUID, optional)
  * `status` (string, optional: `todo`, `in_progress`, `review`, `done`)
  * `priority` (string, optional: `low`, `medium`, `high`)
  * `assigneeId` (UUID, optional)
  * `dueDate` (date string `YYYY-MM-DD`, optional)
  * `tag` (string, optional)

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "items": [
    {
      "id": "e038db48-28ef-4176-9051-57422f28ea90",
      "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
      "title": "Configure Redis Replication",
      "description": "Deploy Redis master-replica stateful set.",
      "status": "in_progress",
      "priority": "high",
      "assigneeId": "987fcdeb-51a2-43d7-9012-345678901234",
      "dueDate": "2026-11-20",
      "tags": ["Database", "Redis"],
      "createdAt": "2026-10-30T15:00:00Z",
      "updatedAt": "2026-10-30T15:30:00Z"
    }
  ],
  "pagination": {
    "totalItems": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### **❌ Negative Scenario (`422 Unprocessable Entity`)**

```json
{
  "status_code": 422,
  "success": false,
  "message": "Validation Error",
  "detail": [
    {
      "type": "greater_than_equal",
      "loc": ["query", "page"],
      "msg": "Input should be greater than or equal to 1",
      "input": 0
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

### **22. `POST /tasks`**

* **Summary:** Create a new task within a project.
* **Access:** Admin only

#### **Request Body**

```json
{
  "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "title": "Setup Ingress Controller",
  "description": "Configure NGINX Ingress and SSL cert-manager.",
  "status": "todo",
  "priority": "high",
  "assigneeId": "987fcdeb-51a2-43d7-9012-345678901234",
  "dueDate": "2026-11-25",
  "tags": ["DevOps", "Ingress"]
}
```

#### **✅ Positive Scenario (`201 Created`)**

```json
{
  "id": "fa129038-4176-48ef-9051-78901234ea90",
  "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "title": "Setup Ingress Controller",
  "description": "Configure NGINX Ingress and SSL cert-manager.",
  "status": "todo",
  "priority": "high",
  "assigneeId": "987fcdeb-51a2-43d7-9012-345678901234",
  "dueDate": "2026-11-25",
  "tags": ["DevOps", "Ingress"],
  "createdAt": "2026-10-30T17:40:00Z",
  "updatedAt": "2026-10-30T17:40:00Z"
}
```

#### **❌ Negative Scenario (`400 Bad Request`)**

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

---

### **23. `GET /tasks/{id}`**

* **Summary:** Fetch details of a single task.
* **Access:** Authenticated

#### **Path Parameters**
* `id` (UUID): Task identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "e038db48-28ef-4176-9051-57422f28ea90",
  "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "title": "Configure Redis Replication",
  "description": "Deploy Redis master-replica stateful set.",
  "status": "in_progress",
  "priority": "high",
  "assigneeId": "987fcdeb-51a2-43d7-9012-345678901234",
  "dueDate": "2026-11-20",
  "tags": ["Database", "Redis"],
  "createdAt": "2026-10-30T15:00:00Z",
  "updatedAt": "2026-10-30T15:30:00Z"
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Task not found",
  "detail": "Task with identifier 'e038db48-28ef-4176-9051-57422f28ea90' not found.",
  "error": {
    "code": "TASK_NOT_FOUND",
    "details": {
      "entity": "Task",
      "identifier": "e038db48-28ef-4176-9051-57422f28ea90"
    }
  }
}
```

---

### **24. `PATCH /tasks/{id}`**

* **Summary:** Update task status, assignee, priority, title, description, or tags.
* **Access:** Authenticated (Assignee or Admin)

#### **Path Parameters**
* `id` (UUID): Task identifier.

#### **Request Body**

```json
{
  "status": "done",
  "priority": "medium"
}
```

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "e038db48-28ef-4176-9051-57422f28ea90",
  "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "title": "Configure Redis Replication",
  "description": "Deploy Redis master-replica stateful set.",
  "status": "done",
  "priority": "medium",
  "assigneeId": "987fcdeb-51a2-43d7-9012-345678901234",
  "dueDate": "2026-11-20",
  "tags": ["Database", "Redis"],
  "createdAt": "2026-10-30T15:00:00Z",
  "updatedAt": "2026-10-30T17:45:00Z"
}
```

#### **❌ Negative Scenario (`403 Forbidden`)**

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

---

### **25. `DELETE /tasks/{id}`**

* **Summary:** Soft delete a task (or permanent delete when specified).
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Task identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "success": true,
  "message": "Task deleted successfully."
}
```

#### **❌ Negative Scenario (`403 Forbidden`)**

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

---

### **26. `POST /tasks/{id}/restore`**

* **Summary:** Restore a soft-deleted task.
* **Access:** Admin only

#### **Path Parameters**
* `id` (UUID): Task identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "id": "e038db48-28ef-4176-9051-57422f28ea90",
  "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
  "title": "Configure Redis Replication",
  "description": "Deploy Redis master-replica stateful set.",
  "status": "in_progress",
  "priority": "high",
  "assigneeId": "987fcdeb-51a2-43d7-9012-345678901234",
  "dueDate": "2026-11-20",
  "tags": ["Database", "Redis"],
  "createdAt": "2026-10-30T15:00:00Z",
  "updatedAt": "2026-10-30T18:00:00Z"
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Task not found",
  "detail": "Task with identifier 'e038db48-28ef-4176-9051-57422f28ea90' not found.",
  "error": {
    "code": "TASK_NOT_FOUND",
    "details": {
      "entity": "Task",
      "identifier": "e038db48-28ef-4176-9051-57422f28ea90"
    }
  }
}
```

---

## **7. Project & Task Activities (2 Routes)**

### **27. `GET /tasks/activities`**

* **Summary:** Global activity audit feed of task state transitions across projects.
* **Access:** Authenticated
* **Query Parameters:**
  * `limit` (integer, default `50`, max `100`)

#### **✅ Positive Scenario (`200 OK`)**

```json
[
  {
    "id": "fe901289-4829-4112-9901-293847561029",
    "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
    "taskId": "e038db48-28ef-4176-9051-57422f28ea90",
    "taskTitle": "Configure Redis Replication",
    "userId": "987fcdeb-51a2-43d7-9012-345678901234",
    "userName": "Sarah Connor",
    "fromStatus": "in_progress",
    "toStatus": "done",
    "createdAt": "2026-10-30T17:45:00Z"
  }
]
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

### **28. `GET /projects/{id}/activities`**

* **Summary:** Activity audit trail scoped to a specific project.
* **Access:** Authenticated

#### **Path Parameters**
* `id` (UUID): Project identifier.

#### **✅ Positive Scenario (`200 OK`)**

```json
[
  {
    "id": "fe901289-4829-4112-9901-293847561029",
    "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
    "taskId": "e038db48-28ef-4176-9051-57422f28ea90",
    "taskTitle": "Configure Redis Replication",
    "userId": "987fcdeb-51a2-43d7-9012-345678901234",
    "userName": "Sarah Connor",
    "fromStatus": "todo",
    "toStatus": "in_progress",
    "createdAt": "2026-10-30T15:05:00Z"
  }
]
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Project not found",
  "detail": "Project with identifier '2d8f99e0-1284-4fe1-9231-10c0828fe9aa' not found.",
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "details": {
      "entity": "Project",
      "identifier": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa"
    }
  }
}
```

---

## **8. Dashboard & Analytics (2 Routes)**

### **29. `GET /dashboard/stats`**

* **Summary:** Retrieve role-tailored dashboard metrics and activities with Redis caching (TTL: 60s).
* **Access:** Authenticated (Admins receive global metrics; Members receive assigned metrics).

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "totalProjects": 4,
  "activeProjects": 3,
  "totalTasks": 28,
  "completedTasks": 18,
  "teamMembers": 8,
  "activeUsers": 6,
  "completionRate": 64.3,
  "overdueTasks": 2,
  "recentActivities": [
    {
      "id": "fe901289-4829-4112-9901-293847561029",
      "projectId": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa",
      "taskId": "e038db48-28ef-4176-9051-57422f28ea90",
      "taskTitle": "Configure Redis Replication",
      "userId": "987fcdeb-51a2-43d7-9012-345678901234",
      "userName": "Sarah Connor",
      "fromStatus": "in_progress",
      "toStatus": "done",
      "createdAt": "2026-10-30T17:45:00Z"
    }
  ]
}
```

#### **❌ Negative Scenario (`401 Unauthorized`)**

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

### **30. `GET /analytics/data`**

* **Summary:** Aggregated status distribution, assignee workloads, and completion velocity for Recharts (Redis TTL: 300s).
* **Access:** Authenticated
* **Query Parameters:**
  * `projectId` (UUID, optional: filters dataset to single project)

#### **✅ Positive Scenario (`200 OK`)**

```json
{
  "statusDistribution": [
    { "name": "To Do", "value": 5, "color": "#6366F1" },
    { "name": "In Progress", "value": 3, "color": "#F59E0B" },
    { "name": "Review", "value": 2, "color": "#8B5CF6" },
    { "name": "Done", "value": 18, "color": "#10B981" }
  ],
  "workload": [
    {
      "memberId": "987fcdeb-51a2-43d7-9012-345678901234",
      "memberName": "Sarah Connor",
      "assigned": 6,
      "completed": 4,
      "overdue": 0
    }
  ],
  "completionTrends": [
    {
      "date": "2026-10-29",
      "completedTasks": 3
    },
    {
      "date": "2026-10-30",
      "completedTasks": 5
    }
  ]
}
```

#### **❌ Negative Scenario (`404 Not Found`)**

```json
{
  "status_code": 404,
  "success": false,
  "message": "Project not found",
  "detail": "Project with identifier '2d8f99e0-1284-4fe1-9231-10c0828fe9aa' not found.",
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "details": {
      "entity": "Project",
      "identifier": "2d8f99e0-1284-4fe1-9231-10c0828fe9aa"
    }
  }
}
```
