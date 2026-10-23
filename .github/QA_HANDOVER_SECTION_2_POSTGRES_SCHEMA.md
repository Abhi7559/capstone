## 2. Postgres Schema and Tables

The PostgreSQL database consists of exactly **5 relational tables** required by our frontend and API contracts:

1. `users` — Authentication, RBAC, profiles, and password-change state
2. `projects` — Project deliverables, dates, priorities, categories, and progress
3. `project_members` — Many-to-Many bridge between users and projects
4. `tasks` — Kanban tasks, statuses, priorities, deadlines, and tags
5. `project_activities` — Audit logs tracking task status changes per project (`GET /api/v1/projects/{id}/activities`)

---

### Table 1: `users`
Stores user identity, role, credentials, and onboarding security state.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | **PRIMARY KEY**, Default `uuid_generate_v4()` | Unique user identifier |
| `email` | `VARCHAR(255)` | **UNIQUE**, **NOT NULL** | User login email (case-insensitive indexed) |
| `hashed_password` | `VARCHAR(255)` | **NOT NULL** | Bcrypt password hash |
| `name` | `VARCHAR(150)` | **NOT NULL** | User display name |
| `role` | `VARCHAR(20)` | **NOT NULL**, Values: `'admin'`, `'member'` | System permission role |
| `status` | `VARCHAR(20)` | **NOT NULL**, Default `'active'`, Values: `'active'`, `'invited'`, `'suspended'` | Account activation state |
| `designation` | `VARCHAR(150)` | Nullable, Default `'Contributor'` | Job title / designation |
| `requires_password_change` | `BOOLEAN` | **NOT NULL**, Default `false` | Forces password change upon first login for invited members |
| `joining_date` | `DATE` | **NOT NULL**, Default `CURRENT_DATE` | Date the member joined workspace |
| `created_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Last profile update timestamp |

---

### Table 2: `projects`
Stores high-level workspace project deliverables, timelines, priorities, and workflow progress.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | **PRIMARY KEY**, Default `uuid_generate_v4()` | Unique project identifier |
| `name` | `VARCHAR(255)` | **NOT NULL**, Indexed | Project title |
| `description` | `TEXT` | Nullable | Detailed project objective |
| `status` | `VARCHAR(50)` | **NOT NULL**, Default `'planning'`, Values: `'planning'`, `'active'`, `'completed'`, `'on-hold'`, `'archived'` | Current project status |
| `previous_status` | `VARCHAR(50)` | Nullable | Preserves prior status when project is moved to `'archived'` |
| `category` | `VARCHAR(100)` | **NOT NULL**, Default `'General'` | Department/Category (e.g., Engineering, Marketing) |
| `priority` | `VARCHAR(30)` | **NOT NULL**, Default `'medium'`, Values: `'low'`, `'medium'`, `'high'`, `'critical'` | Execution urgency |
| `start_date` | `DATE` | **NOT NULL** | Project planned start date |
| `due_date` | `DATE` | **NOT NULL** | Project deadline date (`due_date >= start_date`) |
| `progress` | `INTEGER` | **NOT NULL**, Default `0`, Check `(progress BETWEEN 0 AND 100)` | Dynamic completion percentage |
| `created_by` | `UUID` | **FOREIGN KEY** `users(id)` ON DELETE SET NULL | Admin who initiated the project |
| `created_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Last update timestamp |

---

### Table 3: `project_members`
Association bridge table managing the Many-to-Many relationship between Projects and Users.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `project_id` | `UUID` | **PRIMARY KEY**, **FOREIGN KEY** `projects(id)` ON DELETE CASCADE | Associated project identifier |
| `user_id` | `UUID` | **PRIMARY KEY**, **FOREIGN KEY** `users(id)` ON DELETE CASCADE | Associated user collaborator identifier |
| `role_in_project` | `VARCHAR(50)` | Default `'contributor'` | Collaborator role within project context |
| `assigned_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Timestamp when user was assigned to project |

---

### Table 4: `tasks`
Stores individual work items managed across project Kanban boards.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | **PRIMARY KEY**, Default `uuid_generate_v4()` | Unique task identifier |
| `project_id` | `UUID` | **FOREIGN KEY** `projects(id)` ON DELETE CASCADE, **NOT NULL** | Parent project identifier |
| `assignee_id` | `UUID` | **FOREIGN KEY** `users(id)` ON DELETE SET NULL, Nullable | Designated owner of the task |
| `title` | `VARCHAR(255)` | **NOT NULL** | Short, actionable task summary |
| `description` | `TEXT` | Nullable | Detailed specifications / acceptance criteria |
| `status` | `VARCHAR(50)` | **NOT NULL**, Default `'todo'`, Values: `'backlog'`, `'todo'`, `'in_progress'`, `'done'` | Kanban column position |
| `priority` | `VARCHAR(30)` | **NOT NULL**, Default `'medium'`, Values: `'low'`, `'medium'`, `'high'`, `'critical'` | Urgency rating |
| `due_date` | `DATE` | **NOT NULL** | Task completion deadline |
| `tags` | `JSONB` | Default `'[]'::jsonb`, **NOT NULL** | Flexible array of tag labels (e.g. `["backend", "redis"]`) |
| `created_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Timestamp when task was created |
| `updated_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Timestamp when task was last modified |

---

### Table 5: `project_activities`
Captures granular audit records for task transitions and lifecycle events within a project.

| Column Name | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | **PRIMARY KEY**, Default `uuid_generate_v4()` | Unique audit event identifier |
| `project_id` | `UUID` | **FOREIGN KEY** `projects(id)` ON DELETE CASCADE, **NOT NULL** | Associated project identifier |
| `task_id` | `UUID` | **FOREIGN KEY** `tasks(id)` ON DELETE CASCADE, **NOT NULL** | Associated task identifier |
| `task_title` | `VARCHAR(255)` | **NOT NULL** | Snapshot of task title at event creation |
| `user_id` | `UUID` | **FOREIGN KEY** `users(id)` ON DELETE SET NULL, Nullable | User who performed the status change |
| `user_name` | `VARCHAR(150)` | **NOT NULL** | Snapshot of user display name |
| `from_status` | `VARCHAR(50)` | **NOT NULL** | Status before transition (e.g. `'todo'`) |
| `to_status` | `VARCHAR(50)` | **NOT NULL** | Status after transition (e.g. `'in_progress'`) |
| `created_at` | `TIMESTAMPTZ` | Default `CURRENT_TIMESTAMP` | Event timestamp |


