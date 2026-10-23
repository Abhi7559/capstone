# Architectural Decision Records (ADR): Why This Architecture Was Chosen

This document details the exact engineering rationale behind each architectural choice made in the **Team Hub Backend Technical Specification**. When communicating with mentors, technical leads, or QA engineers, use these structured justifications.

---

## 1. Why FastAPI (Python ASGI) Over Traditional Frameworks (Django / Flask)?

### The Decision:
We selected **FastAPI** running on the asynchronous ASGI server **Uvicorn**.

### Why We Decided This:
1. **Asynchronous Concurrency (I/O Bound Workloads):**
   - Our platform performs frequent concurrent operations: database queries, Redis cache lookups, and external SMTP email dispatching.
   - Traditional synchronous frameworks (like standard Flask or Django WSGI) block the worker thread during database or network calls. FastAPI's native `async/await` pipeline handles hundreds of concurrent connections per worker with negligible memory footprint.
2. **Native Pydantic v2 Integration:**
   - In traditional frameworks, serialization and validation require separate libraries (e.g., Marshmallow, Django REST Framework serializers). FastAPI evaluates Pydantic models directly in the request pipeline, giving us sub-millisecond Rust-backed validation and automatic OpenAPI documentation generation.
3. **Seamless Dual Capability (Headless REST + Jinja2 HTML):**
   - FastAPI allows serving both standard JSON REST endpoints (`/api/v1/*`) and server-rendered HTML template views (`Jinja2Templates` on `/task_management/api/v1/login`) from the exact same application instance without complex dual-framework setups.

---

## 2. Why PostgreSQL 16 as the Relational System of Record?

### The Decision:
We chose **PostgreSQL 16** with strict foreign keys, cascading deletion rules, and B-Tree indexes over NoSQL document stores (like MongoDB) or flat files (`data/db.json`).

### Why We Decided This:
1. **Relational Integrity is Non-Negotiable for Workspaces:**
   - Tasks cannot exist without a parent Project. Collaborators cannot be assigned to tasks unless they belong to the project.
   - In NoSQL, preventing orphan tasks or dangling references requires complex application-level validation code. In PostgreSQL, database-level foreign keys (`ON DELETE CASCADE` for projects, `ON DELETE SET NULL` for deleted members) guarantee 100% data integrity even during concurrent deletions.
2. **ACID Transactions for State Transitions:**
   - When a user moves a task from `todo` to `in_progress`, two operations must succeed atomically:
     - Update the `tasks` row.
     - Insert the audit trail row into `project_activities`.
   - If the database crashes mid-flight, PostgreSQL rolls back both, preventing corrupt audit histories.
3. **JSONB for Tags without Sacrificing Normalization:**
   - Instead of creating an over-engineered sixth table (`task_tags`) requiring expensive SQL joins, we utilized PostgreSQL's native `JSONB` column type for tags (`["backend", "redis"]`). This offers NoSQL-like schema flexibility inside an ACID-compliant engine.

---

## 3. Why Redis as an External Caching & Ephemeral Layer?

### The Decision:
We coupled PostgreSQL with **Redis 7** for ephemeral sessions, rate limiting, and KPI query caching.

### Why We Decided This:
1. **Preventing Database Bottlenecks on Dashboards:**
   - The Admin Dashboard queries count aggregations across `projects`, `tasks`, overdue deadlines, and completion percentages.
   - If 50 team members refresh their dashboards simultaneously, running these `COUNT()` and `JOIN` operations against PostgreSQL would spike CPU usage. Redis stores computed dashboard summaries in RAM with a 60-second TTL, reducing primary DB query volume by over 80%.
2. **Token Blacklisting without Hitting PostgreSQL:**
   - JWT tokens are stateless, meaning a standard JWT cannot be revoked before it expires.
   - Storing revoked token IDs (`jti`) in PostgreSQL would require a disk write and database lookup on every single API call. Storing them in Redis with a 7-day TTL provides sub-millisecond revocation checks directly in memory.
3. **Atomic Rate Limiting:**
   - Redis's atomic `INCR` operation provides instant brute-force protection (`ratelimit:login:{ip}`) with zero race conditions.

---

## 4. Why Exactly 5 Relational Tables (No Global Activities or Comments)?

### The Decision:
We finalized the schema to **5 core tables** (`users`, `projects`, `project_members`, `tasks`, `project_activities`), explicitly rejecting `global_activities` and `comments`.

### Why We Decided This:
1. **Direct Alignment with Frontend Reverse Engineering:**
   - A critical principle in full-stack architecture is **never build backend tables that no frontend screen consumes**.
   - Inspection of our Next.js frontend revealed that the only activity drawer that exists in the UI is on the Project Details page (`pages/projects/[id].tsx: line 838`). This is powered strictly by `project_activities`.
   - Creating a `global_activities` table would have required double database writes on every action for data that is never rendered, wasting I/O and creating maintenance overhead.
2. **Lean & Testable:**
   - 5 tables cleanly cover every requirement: Authentication (`users`), Deliverables (`projects`), Permissions (`project_members`), Execution (`tasks`), and Auditing (`project_activities`).

---

## 5. Why `CamelCaseModel` (Bi-directional Pydantic Aliasing)?

### The Decision:
We established a shared `CamelCaseModel` inheriting from Pydantic v2 with `alias_generator = to_camel` and `populate_by_name = True`.

### Why We Decided This:
1. **Respecting Industry Language Conventions:**
   - In TypeScript/JavaScript, standard syntax convention is **`camelCase`** (`projectId`, `dueDate`, `requiresPasswordChange`).
   - In Python, PEP 8 strictly mandates **`snake_case`** (`project_id`, `due_date`, `requires_password_change`).
2. **Zero Frontend Rewrites:**
   - If the backend forced `snake_case` on the JSON endpoints, every React hook, component prop, and form payload in the Next.js app would have to be refactored, risking massive frontend regression bugs.
   - Pydantic's `to_camel` translates JSON keys automatically at the boundary, allowing frontend developers to use standard TypeScript casing while backend developers write clean, idiomatic Python.

---

## 6. Why Zero-Knowledge SMTP Invitations Over Admin Password Setting?

### The Decision:
When an Admin invites a team member (`POST /api/v1/members/invite`), the temporary password is generated in the backend, sent via email (`aiosmtplib`), and **never returned to the Admin or displayed in the modal**.

### Why We Decided This:
1. **Enterprise Security & Zero-Trust Architecture:**
   - If the backend returned the temporary password to the Admin in the API response, any workspace Admin could read the credentials and impersonate the user before they log in.
2. **Eliminates Manual Password Handoffs:**
   - Administrators no longer have to manually copy passwords into insecure Slack or email messages.
3. **Enforced Security Workflow:**
   - Pairing zero-knowledge email delivery with `requires_password_change = true` ensures that the user is the only person who ever knows their permanent workspace password.

---

## 7. Why Server-Side Jinja2 Rendering alongside REST APIs?

### The Decision:
We implemented `GET /task_management/api/v1/login` to serve a server-rendered Jinja2 HTML page alongside the JSON `POST /task_management/api/v1/auth/login` route.

### Why We Decided This:
1. **Evaluation & Curriculum Compliance:**
   - Directly satisfies the mandatory project evaluation requirement: *"at least one route generate contain jinjatemplate"*.
2. **Disaster Recovery & Operational Fallback:**
   - If the Next.js frontend build fails, or the Node.js/Vercel host experience an outage, QA testers and system administrators can still authenticate and interact with backend operations directly via browser HTML.

---

## 8. Summary Defense for QA & Architecture Review

| Decision | Alternative Considered | Why Alternative Was Rejected |
|---|---|---|
| **FastAPI + Async** | Flask / Django | Synchronous blocking I/O, heavy overhead, and lack of native Pydantic v2 validation. |
| **PostgreSQL 16** | MongoDB / Flat JSON | NoSQL lacks relational constraints; flat JSON suffers concurrency locking and lacks ACID guarantees. |
| **Redis 7** | In-Memory Python Dict | Python dicts cannot be shared across multiple Uvicorn workers and lose all cache/rate-limit state on restart. |
| **5 Tables Schema** | 7 Tables (+Global Activity, Comments) | Feature bloat; frontend contains neither comment inputs nor a global activity feed. |
| **`CamelCaseModel`**| Pure snake_case JSON | Forces extensive frontend rewrites across all Next.js React Query hooks. |
| **Zero-Knowledge SMTP**| Admin sets user password | Critical security risk; Admins can view and abuse member credentials. |
| **Jinja2 Login Route** | Pure headless REST | Misses the curriculum requirement and leaves no fallback if the React client is unavailable. |
