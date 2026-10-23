# BACKEND_REQUIREMENTS.md

## 1. Domain Entities & Database Fields

### 1.1 Users Entity (`users`)
Represents members and administrators of the workspace.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `name` (VARCHAR(255), Not Null)
- `email` (VARCHAR(255), Unique, Not Null, Indexed, lowercased)
- `hashed_password` (VARCHAR(255), Not Null) - bcrypt hashed
- `role` (VARCHAR(50) / Enum: `'admin'`, `'member'`, Not Null, default `'member'`)
- `status` (VARCHAR(50) / Enum: `'active'`, `'invited'`, Not Null, default `'active'`)
- `designation` (VARCHAR(255), Nullable) - e.g. "Senior Engineer"
- `joining_date` (DATE, Nullable)
- `requires_password_change` (BOOLEAN, Not Null, default `False`)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`, onupdate `NOW()`)

### 1.2 Projects Entity (`projects`)
Represents projects and initiatives created by administrators.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `name` (VARCHAR(255), Not Null, Indexed)
- `description` (TEXT, Not Null)
- `status` (VARCHAR(50) / Enum: `'planning'`, `'active'`, `'on_hold'`, `'completed'`, `'archived'`, default `'planning'`, Indexed)
- `category` (VARCHAR(100), Nullable, Indexed) - e.g. "Engineering", "Design"
- `priority` (VARCHAR(50) / Enum: `'low'`, `'medium'`, `'high'`, Nullable, default `'medium'`)
- `start_date` (DATE, Nullable)
- `due_date` (DATE, Nullable)
- `end_date` (DATE, Nullable)
- `previous_status` (VARCHAR(50), Nullable) - Used when archiving to restore previous status
- `created_by` (UUID, Foreign Key `users.id` on delete SET NULL, Nullable)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`, onupdate `NOW()`)

### 1.3 Project Members Entity (`project_members`)
Many-to-many junction table assigning users to projects.
- `project_id` (UUID, Foreign Key `projects.id` on delete CASCADE, Not Null)
- `user_id` (UUID, Foreign Key `users.id` on delete CASCADE, Not Null)
- `assigned_at` (TIMESTAMPTZ, default `NOW()`)
- *Primary Key:* Composite `(project_id, user_id)`

### 1.4 Tasks Entity (`tasks`)
Represents deliverable tasks scoped to a single project.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `project_id` (UUID, Foreign Key `projects.id` on delete CASCADE, Not Null, Indexed)
- `title` (VARCHAR(255), Not Null)
- `description` (TEXT, Not Null)
- `priority` (VARCHAR(50) / Enum: `'low'`, `'medium'`, `'high'`, Not Null, default `'medium'`, Indexed)
- `status` (VARCHAR(50) / Enum: `'backlog'`, `'todo'`, `'in_progress'`, `'done'`, Not Null, default `'todo'`, Indexed)
- `assignee_id` (UUID, Foreign Key `users.id` on delete SET NULL, Nullable, Indexed)
- `due_date` (DATE, Not Null, Indexed)
- `tags` (JSONB / ARRAY(VARCHAR), default `'[]'`)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`, onupdate `NOW()`)

### 1.5 Project Activities Entity (`project_activities`)
Audit log recording task workflow progressions within a project.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `project_id` (UUID, Foreign Key `projects.id` on delete CASCADE, Not Null, Indexed)
- `task_id` (UUID, Foreign Key `tasks.id` on delete CASCADE, Not Null)
- `task_title` (VARCHAR(255), Not Null)
- `user_id` (UUID, Foreign Key `users.id` on delete SET NULL, Nullable)
- `user_name` (VARCHAR(255), Not Null)
- `from_status` (VARCHAR(50), Not Null)
- `to_status` (VARCHAR(50), Not Null)
- `created_at` (TIMESTAMPTZ, default `NOW()`, Indexed)

### 1.6 Global Activities Entity (`global_activities`)
Workspace-level audit stream powering the recent activity feed in dashboards.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `type` (VARCHAR(50) / Enum: `'task_created'`, `'task_updated'`, `'project_created'`, `'member_invited'`, Not Null)
- `message` (TEXT, Not Null)
- `timestamp` (TIMESTAMPTZ, default `NOW()`, Indexed)

---

## 2. Authentication & Password Security

### 2.1 Password Security
1. **Hashing:** All user passwords must be hashed using `bcrypt` (work factor 12) before persisting to the database. Plaintext passwords must never be stored, logged, or returned in response payloads.
2. **Password Complexity Validation:**
   - Minimum 8 characters
   - At least 1 uppercase letter (`[A-Z]`)
   - At least 1 lowercase letter (`[a-z]`)
   - At least 1 digit (`[0-9]`)
   - At least 1 special character (`[!@#$%^&*(),.?":{}|<>]`)

### 2.2 JWT Token Architecture
1. **Token Standard:** JSON Web Tokens (JWT) signed with `HS256` or `RS256` algorithm.
2. **Access Token Expiration:** 30 minutes.
3. **Refresh Token Expiration:** 7 days.
4. **Token Claims Payload:**
   ```json
   {
     "sub": "user_uuid",
     "email": "user@example.com",
     "role": "admin",
     "name": "Jane Doe",
     "requires_password_change": false,
     "exp": 1792670000,
     "jti": "random_token_identifier_uuid"
   }
   ```
5. **Temporary Password Restriction Rule:**
   - If a token possesses `requires_password_change: true`, the API gateway / FastAPI dependency MUST restrict user access strictly to:
     - `POST /api/v1/auth/change-password`
     - `GET /api/v1/members/me`
   - Any attempt to access projects, tasks, or dashboard metrics while `requires_password_change: true` returns `403 Forbidden` with detail `"Password change required before accessing workspace resources."`

---

## 3. Role-Based Access Control (RBAC) Specification

| Action | Admin Allowed | Member Allowed | Conditions / Rules |
|---|:---:|:---:|---|
| **View Dashboard Stats** | Yes | Yes | Admin views global counts; Member views personal queue only |
| **List Projects** | Yes | Conditional | Admin views all projects; Member views only projects where they are in `project_members` |
| **Create Project** | Yes | No | Non-admins receive `403 Forbidden` |
| **Update Project** | Yes | No | Non-admins receive `403 Forbidden` |
| **Archive Project** | Yes | No | Non-admins receive `403 Forbidden` |
| **Delete Project** | Yes | No | Non-admins receive `403 Forbidden` |
| **View Project Tasks** | Yes | Conditional | Admin views all; Member must belong to project |
| **Create Task** | Yes | Conditional | Admin can create in any project; Member can only create in assigned projects |
| **Update Task Details** | Yes | Conditional | Admin can edit all; Member can edit tasks in assigned projects |
| **Change Task Status** | Yes | Conditional | Admin and assigned project members can transition task statuses |
| **Delete Task** | Yes | No | Non-admins receive `403 Forbidden` |
| **Invite Member** | Yes | No | Non-admins receive `403 Forbidden` |
| **List Members** | Yes | Yes | All active workspace users can view member directory |
| **Edit Member Profile** | Yes | Conditional | Admin can edit all and modify roles; Member can edit only own `name` and `designation` |
| **Delete Member** | Yes | No | Non-admins receive `403 Forbidden` |
| **View Analytics** | Yes | Yes | Aggregates filtered by accessible projects |

---

## 4. Business Logic & Validation Rules

1. **Project Date Consistency:**
   - When both `start_date` and `due_date` are provided, the API must enforce `due_date >= start_date`.
2. **Task Assignee Verification:**
   - A task can only be assigned to a user who is currently an active member of that task's project (`project_members`).
3. **Automated Audit Logging:**
   - Whenever a task's `status` changes via `PATCH /api/v1/tasks/{id}`, the backend service MUST in the same database transaction:
     - Record the change in `project_activities` (storing `task_title`, `user_name`, `from_status`, `to_status`, and timestamp).
     - Record a summary in `global_activities` (e.g. `"[User] moved [Task] from [From] to [To]"`).
4. **Member Removal Cascade:**
   - When a user is deleted via `DELETE /api/v1/members/{id}`:
     - Remove user from `project_members` junction.
     - Set `tasks.assignee_id` to `NULL` for any tasks assigned to that user.
     - Retain user's historical audit records in `project_activities` with preserved `user_name` snapshot.

---

## 5. Redis Caching & Invalidation Strategy

### 5.1 Caching Opportunities
1. **Executive Dashboard KPIs (`GET /api/v1/dashboard/stats` for Admin):**
   - **Cache Key:** `cache:dashboard:admin:stats`
   - **TTL:** 60 seconds.
   - **Invalidation Triggers:**
     - Creation, update, or deletion of any project.
     - Creation, update, status change, or deletion of any task.
2. **Analytics Overview (`GET /api/v1/analytics/overview`):**
   - **Cache Key:** `cache:analytics:project:{project_id_or_all}`
   - **TTL:** 300 seconds.
   - **Invalidation Triggers:** Task creation, task deletion, task status changes.
3. **JWT Blacklist (Revocation on Logout):**
   - **Key:** `jwt:blacklist:{jti}`
   - **Value:** `"revoked"`
   - **TTL:** Set to remaining lifetime of the token (max 30 minutes).
