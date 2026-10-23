## 7. Unit Tests, Integration Tests, Coverage

### Automated Test Architecture

- **Test Framework & Runner:** `pytest` configured with `pytest-asyncio` for non-blocking asynchronous execution and `httpx.AsyncClient` for direct ASGI gateway testing.
- **Database Isolation Strategy:** Isolated PostgreSQL test database with transactional rollback per test execution, preventing data contamination between test runs.
- **Cache & Ephemeral Isolation:** In-memory `fakeredis` test instance ensuring isolated key spaces and automatic flush between test suites.
- **Third-Party Service Mocking:** Mocking of the asynchronous SMTP transport (`aiosmtplib.send`) to verify invitation email content, temporary password creation, and recipient headers without sending external emails.
- **Quality Gate Criteria:** Enforced minimum code coverage threshold of **$\ge$ 90%** executed via CI/CD pipeline (`pytest --cov=app --cov-fail-under=90`).

---

### Test Categories & Coverage Matrix

| Test Category | Target Scope | Primary Verification Target | Expected Behavior |
|---|---|---|---|
| **1. Integration Tests** | All 23 API Endpoints across 6 Routers | Status codes, camelCase JSON payload schemas, and database side-effects | Returns `200`, `201`, `204`, `400`, `401`, `403`, `404`, `422` as specified |
| **2. Dual-Token & Session Revocation** | `/auth/login`, `/auth/refresh`, `/auth/logout` | Token lifecycle, signature verification, and Redis blacklist storage | Valid token returns `200`; logged-out or revoked token returns `401 Unauthorized` |
| **3. Role-Based Access Control (RBAC)** | Admin-only routes (`POST /projects`, `DELETE /projects/{id}`, `POST /members/invite`, `DELETE /tasks/{id}`) | Role verification via JWT token claims | Admin access is granted (`200`/`201`); Member access is rejected with `403 Forbidden` |
| **4. Multi-Role Dashboard & Caching** | `GET /dashboard/stats` | Role-tailored metrics generation and Redis cache behavior | Admin receives workspace KPIs; Member receives personal task queues; cached in Redis (60s TTL) |
| **5. Business Constraints & Integrity** | Project and task mutations | Relational constraints and date logic rules | Rejects inverted dates (`dueDate < startDate`) with `400`; enforces project member task assignments |
| **6. Server-Side Jinja2 Rendering** | `GET /task_management/api/v1/login` | Direct browser-access login view | Returns Content-Type `text/html` with HTTP `200` rendering the login form and application branding |
| **7. Health Probes** | `GET /health` | Operational infrastructure monitoring | Returns `200 OK` with database and Redis connectivity statuses |

---

### Code Coverage Targets by Component

- **Authentication & Security Layer (`app/core/security.py`):** **100%** coverage (Bcrypt hash generation, password verification, JWT encoding/decoding, and token blacklist checks).
- **Route Authorization Dependencies (`app/api/deps.py`):** **100%** coverage (Token extraction, user context hydration, and role permission enforcement).
- **Pydantic Validation Schemas (`app/schemas/`):** **95%** coverage (Date range validators, email validation, strict type coercion checks, and camelCase serialization).
- **API Route Endpoints (`app/api/v1/endpoints/`):** **90%** coverage (Positive path responses, negative error handling, and query filtering).
- **Database ORM Models (`app/models/`):** **90%** coverage (Foreign key associations, cascading rules, and default values).
