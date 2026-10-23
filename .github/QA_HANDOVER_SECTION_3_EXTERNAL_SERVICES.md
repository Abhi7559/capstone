## 3. External Services - Postgres and Redis

### PostgreSQL

- **Persistent System of Record:** Enforces ACID transaction guarantees, relational constraints, foreign keys, and cascading deletes across the 5 tables:
  - Deleting a project via `DELETE /api/v1/projects/{id}` cascades to delete all associated rows in `tasks`, `project_members`, and `project_activities`.
  - Deleting a member via `DELETE /api/v1/members/{id}` cascades to remove their project associations in `project_members`, while safely setting `assignee_id = NULL` on their assigned tasks (`ON DELETE SET NULL`) to prevent orphan states.
- **Connection Management & Pooling:** Utilizes SQLAlchemy 2.0 `AsyncEngine` with `asyncpg` driver:
  - Configuration: `pool_size=20`, `max_overflow=10`, `pool_recycle=1800` seconds, and `pool_pre_ping=True` to eliminate stale connections.
- **Optimized B-Tree Indexes:**
  - `idx_users_email` on `users(email)` for sub-millisecond credential lookups during authentication.
  - `idx_tasks_project_id` and `idx_tasks_status` on `tasks(project_id, status)` for instant Kanban board rendering.
  - `idx_tasks_assignee_id` on `tasks(assignee_id)` to speed up personalized member dashboard task queries.
  - `idx_project_activities_project` on `project_activities(project_id, created_at DESC)` for high-speed audit log retrieval.

---

### Redis

- **Token Revocation & Session Invalidation:** 
  - Stores active session identifiers (`jti`) and user tokens under the key pattern `auth:token:{user_id}` with a 7-day TTL (`604800s`).
  - Upon calling `POST /api/v1/auth/logout` or `POST /api/v1/auth/change-password`, the token is immediately blacklisted in Redis to prevent replay attacks.
- **Rate Limiting & Brute-Force Protection:**
  - Protects sensitive authentication routes (`POST /task_management/api/v1/login` and `POST /api/v1/auth/change-password`) using a Redis atomic counter:
  - Key pattern: `ratelimit:login:{ip_address}`
  - Rule: Allows a maximum of **5 attempts per 60 seconds per IP**. If exceeded, the backend immediately responds with `429 Too Many Requests`.
- **High-Performance Dashboard & Analytics Cache:**
  - Accelerates heavy aggregation queries for dashboard KPI cards and analytics charts:
  - `cache:dashboard:stats:admin` (TTL: 60 seconds) — Workspace project counts, total tasks, and overdue metrics.
  - `cache:dashboard:stats:member:{user_id}` (TTL: 60 seconds) — Personalized assigned tasks and upcoming deadlines.
  - `cache:analytics:overview` (TTL: 300 seconds) — Aggregated status distribution for charts.
- **Cache Invalidation on Mutation:**
  - Whenever a task is created (`POST /api/v1/tasks`), deleted (`DELETE /api/v1/tasks/{id}`), or has its status moved on the Kanban board (`PATCH /api/v1/tasks/{id}`), the backend automatically purges `cache:dashboard:stats:*` keys so metrics update immediately across the team.
