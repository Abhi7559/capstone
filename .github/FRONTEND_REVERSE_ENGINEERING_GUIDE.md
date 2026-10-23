# FRONTEND_REVERSE_ENGINEERING_GUIDE.md

# How to Build a Backend from an Existing Frontend: The Complete Discovery & Reverse-Engineering Methodology

This guide explains **how a senior backend engineer discovers exactly which API routes are needed, how to extract business logic from the frontend code, and where to start building**.

---

## 1. How Do We Know What Routes Are Required?

To know every route the backend needs, **we do not guess**. We inspect three specific places in the frontend codebase:

```
┌────────────────────────────────────────────────────────┐
│           THE 3 PLACES TO FIND ALL API ROUTES          │
├────────────────────────────────────────────────────────┤
│ 1. The `hooks/` directory (React Query hooks)          │
│    -> Shows exact URLs, HTTP methods, headers & bodies │
├────────────────────────────────────────────────────────┤
│ 2. The `types/` directory (TypeScript definitions)     │
│    -> Shows exact request payloads & response schemas  │
├────────────────────────────────────────────────────────┤
│ 3. The `pages/api/` directory (Existing mock routes)   │
│    -> Shows the exact status codes & existing behavior │
└────────────────────────────────────────────────────────┘
```

### Step 1.1: Look at the `hooks/` Directory (Where Frontend Makes HTTP Calls)
In our project, we open `hooks/`:
- In `hooks/useProjects.ts`, we see:
  - `fetch("/api/projects")` with method `GET` $\rightarrow$ We need: `GET /api/v1/projects`
  - `fetch("/api/projects", { method: "POST", body: JSON.stringify(input) })` $\rightarrow$ We need: `POST /api/v1/projects`
  - `fetch("/api/projects/${id}", { method: "PATCH", body: ... })` $\rightarrow$ We need: `PATCH /api/v1/projects/{id}`
  - `fetch("/api/projects/${id}", { method: "DELETE" })` $\rightarrow$ We need: `DELETE /api/v1/projects/{id}`
- In `hooks/useProjectTasks.ts`, we see:
  - `fetch("/api/tasks?projectId=...&status=...&priority=...")` $\rightarrow$ We need: `GET /api/v1/tasks` with query parameters.
  - `fetch("/api/tasks", { method: "POST" })` $\rightarrow$ We need: `POST /api/v1/tasks`
  - `fetch("/api/tasks/${taskId}", { method: "PATCH" })` $\rightarrow$ We need: `PATCH /api/v1/tasks/{id}`
  - `fetch("/api/tasks/${taskId}", { method: "DELETE" })` $\rightarrow$ We need: `DELETE /api/v1/tasks/{id}`
  - `fetch("/api/projects/${projectId}/activities")` $\rightarrow$ We need: `GET /api/v1/projects/{id}/activities`
- In `hooks/useMembers.ts`, we see:
  - `fetch("/api/members")` $\rightarrow$ We need: `GET /api/v1/members`
  - `fetch("/api/members/invite", { method: "POST" })` $\rightarrow$ We need: `POST /api/v1/members/invite`
  - `fetch("/api/members/${id}", { method: "PUT" })` $\rightarrow$ We need: `PATCH /api/v1/members/{id}`
  - `fetch("/api/members/${id}", { method: "DELETE" })` $\rightarrow$ We need: `DELETE /api/v1/members/{id}`
- In `hooks/useDashboardData.ts`:
  - `fetch("/api/dashboard/stats")` $\rightarrow$ We need: `GET /api/v1/dashboard/stats`
- In `hooks/useAnalyticsData.ts`:
  - `fetch("/api/analytics/data")` $\rightarrow$ We need: `GET /api/v1/analytics/overview`
- In `hooks/useLogin.ts`:
  - `fetch("/api/auth/login")` $\rightarrow$ We need: `POST /api/v1/auth/login`
  - `fetch("/api/auth/change-password")` $\rightarrow$ We need: `POST /api/v1/auth/change-password`

**Result:** By scanning the `hooks/` folder, you have an exact list of all 18 backend endpoints!

---

## 2. How Do We Discover the Data Models (Database Tables)?

To know what tables and columns to create in PostgreSQL, **inspect the `types/` directory**.

- Open `types/auth.ts`:
  ```typescript
  export interface User {
    id: string;
    name: string;
    email: string;
    role: "admin" | "member";
    status?: "active" | "invited";
    designation?: string;
    joiningDate?: string;
    requiresPasswordChange?: boolean;
  }
  ```
  $\rightarrow$ **This tells us our PostgreSQL `users` table fields!**

- Open `types/project.ts`:
  ```typescript
  export interface Project {
    id: string;
    name: string;
    description: string;
    status: "planning" | "active" | "on_hold" | "completed" | "archived";
    memberIds: string[];
    startDate?: string;
    dueDate?: string;
    category?: string;
    priority?: string;
    previousStatus?: ProjectStatus;
  }
  ```
  $\rightarrow$ **This tells us our `projects` table and the `project_members` junction table!**

- Open `types/task.ts`:
  ```typescript
  export interface Task {
    id: string;
    projectId: string;
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    status: "backlog" | "todo" | "in_progress" | "done";
    assigneeId?: string;
    dueDate: string;
    tags: string[];
  }
  ```
  $\rightarrow$ **This tells us our `tasks` table fields and foreign keys!**

---

## 3. How Do We Find Out the Business Logic & Validation Rules?

Business logic is discovered by checking **validation schemas** and **component conditional checks**:

### 3.1 Look at the `schemas/` Directory (Client-Side Validation Rules)
- Open `schemas/project.schema.ts`:
  ```typescript
  .refine(data => !data.startDate || !data.dueDate || new Date(data.dueDate) >= new Date(data.startDate), {
    message: "Due date must be after or equal to start date"
  })
  ```
  $\rightarrow$ **Business Logic Discovered:** The backend must validate `dueDate >= startDate` in Pydantic!

- Open `schemas/auth.schema.ts`:
  - Password requires minimum 8 characters, uppercase, lowercase, number, and special character.
  $\rightarrow$ **Business Logic Discovered:** The backend must enforce this regex in the `change-password` endpoint!

### 3.2 Look at Component Role Conditions (RBAC Rules)
- Open `pages/projects.tsx`:
  ```tsx
  const isAdmin = currentUser?.role === "admin";
  {isAdmin && <button onClick={handleOpenCreateModal}>+ Create Project</button>}
  ```
  $\rightarrow$ **Business Logic Discovered:** Creating, editing, archiving, and deleting projects is restricted to the **Admin** role! Non-admins must receive `403 Forbidden`.

- Open `pages/dashboard.tsx`:
  ```tsx
  const isAdmin = currentUser?.role === "admin";
  const adminData = isAdmin ? dashboardData : null;
  const memberData = !isAdmin ? dashboardData : null;
  ```
  $\rightarrow$ **Business Logic Discovered:** The dashboard endpoint must inspect the caller's JWT role:
  - If `admin`: return global workspace counts and all overdue tasks.
  - If `member`: return only the tasks assigned to `current_user.id`.

- Open `pages/projects/[id].tsx`:
  - When a task is moved to another status column, the right panel updates the "Activity Log".
  $\rightarrow$ **Business Logic Discovered:** Whenever `task.status` is updated, the backend must automatically insert an audit record into `project_activities`!

---

## 4. How to Start: The 4-Step Engineering Process

When starting from zero, always follow this order:

```
STEP 1: The Foundation (Database & Models)
  - Configure .env & async database engine.
  - Write SQLAlchemy models based on types/*.ts.
  - Run Alembic to generate tables in PostgreSQL.

STEP 2: The Security Layer (Auth & RBAC)
  - Write password hashing (bcrypt) and JWT helpers.
  - Implement /auth/login and /auth/change-password.
  - Write the get_current_user and require_role dependencies.

STEP 3: The Data Access & Services Layer (DAOs & Services)
  - Write UserDAO, ProjectDAO, TaskDAO.
  - Write business logic in Services (audit logging, assignee validation).
  - Add FastAPI route controllers.

STEP 4: The Performance & Polish Layer (Redis & Docker)
  - Add Redis caching to dashboard & analytics.
  - Write pytest automated test cases.
  - Package with Docker Compose and switch the frontend's API URL!
```

---

## 5. Summary: Your Mental Model for Future Projects

Whenever someone gives you a frontend and asks you to build the backend:

1. **Find the Endpoints:** Search for `fetch` or `axios` in `hooks/` or `api/`.
2. **Find the Data Schema:** Look at `types/*.ts` or `interfaces/*.ts`.
3. **Find the Business Rules:** Look at `schemas/*.ts` (Zod/Yup) and `if (user.role === 'admin')` conditions in pages.
4. **Build Inside-Out:** Database Models $\rightarrow$ DAOs $\rightarrow$ Services $\rightarrow$ API Routes.
