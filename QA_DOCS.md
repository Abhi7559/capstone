# Task Board — QA and Application Workflow Document

## 1. Project Information

### 1.1 Project Name
**Task Board (capstone-project)** — Enterprise Project Governance & Task Tracking Web Application

### 1.2 Project Overview
Task Board is a high-performance project management and task tracking web application tailored for internal software development and governance teams. Built on Next.js (Pages Router) and TypeScript, it offers end-to-end multi-step project creation, role-based access control (RBAC), agile Kanban board task tracking, real-time status transitions, contributor team management, analytics reporting, and local-storage fallback resilience.

### 1.3 Application Environment
| Item | Details |
| :--- | :--- |
| **Environment** | Local Development & Staging |
| **Application Name** | Task Board (`capstone-project`) |
| **Framework & Router** | Next.js 16.3.4 (Pages Router) |
| **Language** | TypeScript 5 |
| **State Management** | TanStack React Query v5, Zustand v5 |
| **Form & Validation** | React Hook Form v7, Zod v4, @hookform/resolvers |
| **Data Visualization** | Recharts v3 |
| **Styling & Linter** | TailwindCSS v4, Biome v2 |
| **Authentication** | NextAuth.js v4, bcryptjs |

---

## 2. Project and Asset Links

| Item | Details / Purpose |
| :--- | :--- |
| **Application Repository** | [`https://github.com/Abhi7559/capstone.git`](https://github.com/Abhi7559/capstone.git) |
| **Target Branch** | `main` |
| **Local Workspace Path** | `c:\Users\abhishek\capstone-project` |
| **Database Storage File** | `data/db.json` with client `localStorageSync` fallback |

---

## 3. QA Test Environment and Accounts

The application provides seeded test accounts to validate Role-Based Access Control (RBAC) and functional behaviors.

### 3.1 Test Account Matrix

| Role | Email | Default / Temporary Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@gmail.com` | `admin123` | Full Administrative & Workspace Governance |
| **Team Member** | `member@gmail.com` | `member123` | Assigned Task Execution & Member Profile View |

### 3.2 Admin Permissions
The System Admin can:
- Create, edit, and delete workspace projects.
- Manage full Project Lifecycles (`planning`, `active`, `on_hold`, `completed`, `archived`).
- Invite and delete team members.
- Create new tasks and assign them to specific team members.
- Update status or details for any task across all project boards.
- Monitor executive dashboard statistics and real-time analytics graphs.
- Permanently delete projects or tasks.

### 3.3 Member Permissions
The Team Member can:
- View assigned workspace projects.
- View tasks on project Kanban boards.
- Filter tasks by status, priority, or search query.
- **Update status / move Kanban cards ONLY for tasks assigned to them** (or view non-assigned tasks read-only).
- Update subtasks, checklists, and notes on assigned tasks.
- Change personal profile information and temporary passwords.

### 3.4 RBAC Requirement
- Only **Admin** users can create projects, create tasks, assign tasks, delete projects/tasks, and invite members.
- **Members** are strictly limited to assigned task execution and cannot drag or modify tasks assigned to other team members.

---

## 4. Application Features

### 4.1 Authentication & First-Time Password Flow
- Secure credentials authentication with session persistence via Zustand and NextAuth.js.
- Mandatory password change prompt for newly created/invited members upon initial sign-in.

### 4.2 Multi-Step Project Management
- Multi-step modal wizard (`MultiStepProjectModal.tsx`) supporting:
  - **Step 1:** Project Name & Description
  - **Step 2:** Member Assignment, Start Date, and Due/End Date
  - **Step 3:** Priority, Project Lifecycle Status (`planning`, `active`, `on_hold`, `completed`, `archived`), Budget, and Category
  - **Step 4:** Summary & Confirmation

### 4.3 Kanban Task Board
- Interactive drag-and-drop / select column transitions:
  - `To Do` → `In Progress` → `In Review` → `Done`
- Member drag protection: non-assigned members receive forbidden notifications if attempting to move another member's task.
- Column task count badges, completion percentage progress bars, and urgency tags.

### 4.4 Analytics & Reporting
- Comprehensive analytics page (`/analytics`) featuring:
  - **Task Status Distribution** (Pie Chart)
  - **Task Priority Breakdown** (Bar Chart)
  - **Team Workload Allocation** (Assignee distribution)
  - **Completion Rates & Overdue Indicators**

---

## 5. Role-Based Access Control Matrix

| Functionality | Admin | Member |
| :--- | :---: | :---: |
| Sign In / Sign Out | Yes | Yes |
| View Dashboard Stats | Yes | Yes |
| Create Project | Yes | No |
| Edit / Delete Project | Yes | No |
| Change Project Lifecycle Status | Yes | No |
| Invite / Delete Team Members | Yes | No |
| Create Task | Yes | No |
| Assign Task to Member | Yes | No |
| View Project & Task Boards | Yes | Yes |
| Update Status of Assigned Tasks | Yes | Yes |
| Update Status of Unassigned Tasks | Yes | No |
| Delete Task | Yes | No |
| View Analytics | Yes | Yes |

---

## 6. End-to-End Application Workflow

### Phase 1 — Administration & Setup
1. **Admin Sign-In:** Authenticate with `admin@gmail.com`.
2. **Invite Team Members:** Open `/members` and invite new members with specified roles and titles.
3. **Create Projects:** Launch the multi-step project wizard on `/projects`, set timeline, lifecycle status, and assign team members.
4. **Create & Assign Tasks:** Navigate to `/projects/[id]` or `/tasks`, create tasks, set priority (`low`, `medium`, `high`, `urgent`), assign to team members, and place in initial column (`To Do` / `Backlog`).

### Phase 2 — Member Task Execution
1. **Member Sign-In:** Authenticate with `member@gmail.com`.
2. **Filter & View Assigned Work:** View assigned projects on `/projects` and Kanban boards on `/projects/[id]`.
3. **Execute Task Workflow:** Drag & drop assigned task cards across `To Do` → `In Progress` → `In Review` → `Done`.
4. **Task Detail Drawer:** Open task drawer to check off subtasks and append execution notes.

### Phase 3 — Monitoring & Governance
1. **Dashboard Overview:** Review total projects, active count, completed metrics, and overdue alerts.
2. **Analytics Review:** Inspect status breakdown pie charts, priority distribution, and team workload.

---

## 7. Technical Architecture & Resilience

### 7.1 Data Storage & Synchronization
- Primary server storage in JSON database (`data/db.json`).
- Resilient client sync (`utils/localStorageSync.ts`) maintaining local offline persistence and immediate optimistic state updates across tab reloads.

### 7.2 API Endpoints
- `POST /api/auth/login` — Session authentication
- `POST /api/auth/change-password` — Password updates
- `GET / POST / PATCH / DELETE /api/projects` & `/api/projects/[id]` — Project CRUD
- `GET / POST / PATCH / DELETE /api/tasks` & `/api/tasks/[id]` — Task CRUD
- `GET / POST / DELETE /api/members` & `/api/members/[id]` — Member CRUD
- `GET /api/dashboard/stats` — Dashboard statistics
- `GET /api/analytics/data` — Real-time analytics breakdown

---

## 8. QA Verification Checklist

### Authentication & Security
- [ ] Admin login (`admin@gmail.com` / `admin123`) succeeds and redirects to `/dashboard`.
- [ ] Member login (`member@gmail.com` / `member123`) succeeds.
- [ ] First-time password change prompt validates and updates credentials.
- [ ] Invalid credentials trigger clear error toast notifications.

### Project Governance
- [ ] Admin can launch `MultiStepProjectModal` and create projects in `Planning`, `Active`, or `On Hold` status.
- [ ] Project cards display exact status badges and member avatar stacks.
- [ ] Summary metrics cards accurately report Total, Active, and Archived workspace counts.
- [ ] Deleting a project permanently removes it from UI and server storage.

### Kanban & Task Execution
- [ ] Admin can create tasks and assign them to specific team members.
- [ ] Assigned member can move task cards across `To Do` → `In Progress` → `In Review` → `Done`.
- [ ] Non-assigned members are restricted from updating or moving other members' task cards.
- [ ] Task completion percentage updates immediately on Kanban board and project card.

### Analytics & Data Integrity
- [ ] Real-time task status changes dynamically update Pie & Bar charts on `/analytics`.
- [ ] Page refreshes preserve all newly created projects, tasks, and status changes.
- [ ] `npm run build` completes with 0 TypeScript or linting errors.

---

## 9. QA Acceptance Sign-Off

- **Project:** Task Board (`capstone-project`)
- **QA Scope:** Authentication, RBAC, Multi-Step Projects, Kanban Board, Member Assignment, Analytics, and Data Persistence
- **Build Status:** PASSED (`npm run build` code 0)
- **Code Health:** PASSED (`npx biome check .` 0 errors, 0 warnings)
