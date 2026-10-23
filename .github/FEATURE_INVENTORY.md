# FEATURE_INVENTORY.md

This inventory documents all interactive features, screens, forms, modals, buttons, tables, filters, and charts identified in the existing Team Hub frontend codebase.

---

## 1. Feature Catalog

### 1.1 Authentication & Security

#### Feature: User Login
- **File Location:** `pages/login.tsx`, `hooks/useLogin.ts`, `schemas/auth.schema.ts`
- **Description:** Authenticates workspace users via email and password. Detects if temporary password rotation is required.
- **User Actions:** Enter email & password, click "Sign in", click demo credential chips (Admin/Member autofill).
- **Input Fields:**
  - `email` (string, required, valid email format)
  - `password` (string, required, min 6 characters)
  - `rememberMe` (boolean checkbox)
- **Displayed Data:** Error alert banner on failure, quick-fill demo credential cards with role descriptions.
- **Current Data Source:** Next.js API `/api/auth/login` and NextAuth credentials callback (`pages/api/auth/[...nextauth].ts`).
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `POST /api/v1/auth/login`

#### Feature: Forced & Voluntary Password Change
- **File Location:** `components/ChangePasswordModal.tsx`, `pages/login.tsx`, `components/TopBar.tsx`
- **Description:** If a user logs in with `requiresPasswordChange: true`, a modal locks the screen until password is changed. Also accessible voluntarily from the TopBar user dropdown.
- **User Actions:** Enter current password, new password, confirm new password, submit form.
- **Input Fields:**
  - `currentPassword` (string, required)
  - `newPassword` (string, required, min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character)
  - `confirmPassword` (string, required, must match `newPassword`)
- **Displayed Data:** Live password strength meters/checkmarks, error feedback.
- **Current Data Source:** Next.js API `/api/auth/change-password`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `POST /api/v1/auth/change-password`

#### Feature: User Logout
- **File Location:** `components/TopBar.tsx`, `components/Sidebar.tsx`
- **Description:** Clears client auth session, clears Zustand store, wipes `localStorage`, signs out NextAuth, and redirects to `/login`.
- **User Actions:** Click user avatar -> click "Sign out".
- **Input Fields:** None.
- **Displayed Data:** None.
- **Current Data Source:** NextAuth `signOut()` + Zustand `logout()`.
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `POST /api/v1/auth/logout` (token revocation / Redis blacklist)

---

### 1.2 Dashboard Views

#### Feature: Admin Executive Dashboard
- **File Location:** `pages/dashboard.tsx`, `hooks/useDashboardData.ts`
- **Description:** Provides workspace-wide overview for users with the `admin` role.
- **User Actions:** View metrics, click quick-action navigation buttons ("+ Create Project", "Invite Member"), navigate to projects or tasks.
- **Input Fields:** None.
- **Displayed Data:**
  - `totalProjects` (KPI count)
  - `totalTasks` (KPI count)
  - `completedTasks` (KPI count)
  - `overdueTasks` (KPI count with warning styling)
  - `recentlyCreatedTasks` (list of tasks with project name, priority, due date, assignee)
  - `recentActivity` (timeline of actions across workspace: task updates, project creation)
- **Current Data Source:** Next.js API `/api/dashboard/stats`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/dashboard/stats`

#### Feature: Member Personal Dashboard
- **File Location:** `pages/dashboard.tsx`, `hooks/useDashboardData.ts`
- **Description:** Personalized operational dashboard for users with the `member` role.
- **User Actions:** Review assigned tasks, view upcoming deadlines, navigate directly to assigned projects.
- **Input Fields:** None.
- **Displayed Data:**
  - `myAssignedTasks` (list of tasks assigned to current member)
  - `myOverdueTasks` (critical alert list of member tasks past due date)
  - `tasksDueSoon` (tasks due within next 72 hours)
  - `myProjects` (cards of projects where member is assigned)
  - `recentActivity` (member-relevant activity items)
- **Current Data Source:** Next.js API `/api/dashboard/stats`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/dashboard/stats`

---

### 1.3 Projects Management

#### Feature: Projects Directory & Filtered View
- **File Location:** `pages/projects.tsx`, `hooks/useProjects.ts`
- **Description:** Renders all projects accessible to the user with search, status filtering, category filtering, and grid vs list view toggling.
- **User Actions:** Search by text query, click status tabs (`All`, `Active`, `Planning`, `On Hold`, `Completed`, `Archived`), select category filter, toggle Grid/List mode, click card to navigate to `/projects/[id]`.
- **Input Fields:** Search input, status pill tabs, category select dropdown, sort order selector.
- **Displayed Data:** Project title, description, category, priority badge, progress percentage bar, member avatar stack, start/due dates, lifecycle status badge.
- **Current Data Source:** Next.js API `/api/projects`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/projects`

#### Feature: Multi-Step Project Creation Wizard
- **File Location:** `components/MultiStepProjectModal.tsx`, `hooks/useProjects.ts`
- **Description:** 3-step modal dialog for Admins to create a new project with real-time preview.
- **User Actions:**
  - *Step 1 (Basic Info):* Fill Name, Description. Click "Next".
  - *Step 2 (Metadata & Dates):* Select Status, Category, Priority, Start Date, Due Date. Click "Next".
  - *Step 3 (Team & Review):* Check/uncheck team members from list, review live card preview, click "Create Project".
- **Input Fields:**
  - `name` (string, required, min 3 chars)
  - `description` (string, required, min 10 chars)
  - `status` (`planning` | `active` | `on_hold` | `completed`)
  - `category` (string, e.g., "Engineering", "Design", "Marketing")
  - `priority` (`low` | `medium` | `high`)
  - `startDate` (YYYY-MM-DD date)
  - `dueDate` (YYYY-MM-DD date, must be >= startDate)
  - `memberIds` (array of member UUID strings)
- **Displayed Data:** Step indicators, live preview card showing progress and team chips.
- **Current Data Source:** Next.js API `/api/projects` (POST)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `POST /api/v1/projects`

#### Feature: Edit Project
- **File Location:** `components/MultiStepProjectModal.tsx`, `pages/projects.tsx`
- **Description:** Pre-populates the 3-step wizard with existing project details for updating.
- **User Actions:** Select "Edit Project" from project card three-dot menu, modify fields, click "Save Changes".
- **Input Fields:** Same as Create Project.
- **Displayed Data:** Pre-filled project details.
- **Current Data Source:** Next.js API `/api/projects/[id]` (PATCH)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `PATCH /api/v1/projects/{id}`

#### Feature: Archive / Restore Project
- **File Location:** `pages/projects.tsx`, `utils/projectUtils.ts`
- **Description:** One-click toggle that transitions an active project to `archived` or restores an archived project back to its previous status.
- **User Actions:** Click "Archive Project" or "Restore Project" from card action menu.
- **Input Fields:** None.
- **Displayed Data:** Toast message confirming status transition.
- **Current Data Source:** Next.js API `/api/projects/[id]` (PATCH)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `PATCH /api/v1/projects/{id}`

#### Feature: Delete Project
- **File Location:** `pages/projects.tsx`, `hooks/useProjects.ts`
- **Description:** Deletes project permanently along with cascaded tasks. Admin only.
- **User Actions:** Click "Delete Project" from menu, confirm dialog prompt.
- **Input Fields:** Confirmation button click.
- **Displayed Data:** Warning prompt, deletion toast.
- **Current Data Source:** Next.js API `/api/projects/[id]` (DELETE)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `DELETE /api/v1/projects/{id}`

---

### 1.4 Project Details & Task Management

#### Feature: Project Kanban Board & List Views
- **File Location:** `pages/projects/[id].tsx`, `hooks/useProjectTasks.ts`
- **Description:** Comprehensive board showing tasks divided into 4 columns (`backlog`, `todo`, `in_progress`, `done`) or a tabular list view. Includes real-time search, status filter, priority filter, and assignee filter.
- **User Actions:** Drag tasks or use quick move selector, search tasks, filter by assignee/priority, toggle between Kanban and Table views.
- **Input Fields:** Search input, status dropdown, priority dropdown, assignee dropdown.
- **Displayed Data:** Project header metadata (dates, category, progress percentage bar, member roster), task cards with priority badges, due dates, assignee avatars, tags.
- **Current Data Source:** Next.js API `/api/tasks?projectId={id}` & `/api/projects/{id}`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/projects/{id}`, `GET /api/v1/tasks?project_id={id}`

#### Feature: Multi-Step Task Creation Wizard
- **File Location:** `components/MultiStepCreateTaskModal.tsx`, `hooks/useProjectTasks.ts`
- **Description:** 3-step wizard allowing Admin or project members to create tasks with tags, assignees, and deadlines.
- **User Actions:**
  - *Step 1 (Details):* Enter Title, Description. Click "Next".
  - *Step 2 (Classification):* Select Priority, Status, Due Date. Click "Next".
  - *Step 3 (Assignment & Tags):* Select Assignee from project members, add tag pills, click "Create Task".
- **Input Fields:**
  - `title` (string, required, min 3 chars)
  - `description` (string, required)
  - `priority` (`low` | `medium` | `high`)
  - `status` (`backlog` | `todo` | `in_progress` | `done`)
  - `dueDate` (YYYY-MM-DD date string)
  - `assigneeId` (UUID string, optional)
  - `tags` (string array)
- **Displayed Data:** Step indicators, tag chips with deletion crosses.
- **Current Data Source:** Next.js API `/api/tasks` (POST)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `POST /api/v1/tasks`

#### Feature: Task Detail & Status Transition Modal
- **File Location:** `components/TaskDetailModal.tsx`, `hooks/useProjectTasks.ts`
- **Description:** Inspects task details, enables quick status progression (e.g. from `in_progress` to `done`), editing title/description/priority/assignee, or deleting task (Admin only).
- **User Actions:** Click task card on board -> opens modal. Modify fields or click status advance buttons.
- **Input Fields:** Editable title, description, priority select, status select, assignee select, due date picker.
- **Displayed Data:** Full task details, created/updated timestamps, project name, assignee name.
- **Current Data Source:** Next.js API `/api/tasks/[id]` (PATCH/DELETE)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/tasks/{id}`, `PATCH /api/v1/tasks/{id}`, `DELETE /api/v1/tasks/{id}`

#### Feature: Project Status Activity Stream
- **File Location:** `pages/projects/[id].tsx`, `hooks/useProjectTasks.ts`
- **Description:** Real-time audit log inside project view showing historical task movements between workflow states.
- **User Actions:** Scroll activity panel.
- **Input Fields:** None.
- **Displayed Data:** `taskTitle`, `userName` (who changed it), `fromStatus` -> `toStatus`, relative timestamp (e.g., "5 minutes ago").
- **Current Data Source:** Next.js API `/api/projects/[id]/activities`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/projects/{id}/activities`

---

### 1.5 Team Members Directory

#### Feature: Members Directory & Profile View
- **File Location:** `pages/members.tsx`, `components/MemberProfileModal.tsx`
- **Description:** Displays all workspace members in a responsive table (desktop) and card list (mobile). Clicking a member opens their profile modal.
- **User Actions:** Click member row/card to open `MemberProfileModal`.
- **Input Fields:** None.
- **Displayed Data:** Avatar, full name, email address, role badge (`Admin` or `Member`), designation, joining date, status badge (`active` or `invited`).
- **Current Data Source:** Next.js API `/api/members`
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/members`

#### Feature: Invite Team Member
- **File Location:** `components/InviteMemberModal.tsx`, `hooks/useMembers.ts`
- **Description:** Allows Admins to invite a new user. Auto-generates a secure 12-character temporary password and sets `requiresPasswordChange: true`.
- **User Actions:** Fill member details, submit modal. On success, view generated temporary password with a "Copy to Clipboard" button.
- **Input Fields:**
  - `name` (string, required)
  - `email` (string, required, unique email)
  - `designation` (string, optional)
  - `joiningDate` (date, optional)
- **Displayed Data:** Success confirmation screen containing the plain temporary password and instructions.
- **Current Data Source:** Next.js API `/api/members/invite` (POST)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `POST /api/v1/members/invite`

#### Feature: Edit Member Profile & Role
- **File Location:** `components/MemberProfileModal.tsx`, `hooks/useMembers.ts`
- **Description:** Edit user profile attributes. Admins can promote/demote user roles (`admin` <-> `member`). Members can only edit their own name/designation.
- **User Actions:** Update inputs, click "Save Changes".
- **Input Fields:** `name`, `designation`, `role` (Admin only).
- **Displayed Data:** Member account info, assigned project count, status.
- **Current Data Source:** Next.js API `/api/members/[id]` (PUT/PATCH)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `PATCH /api/v1/members/{id}`

#### Feature: Delete Member
- **File Location:** `components/MemberProfileModal.tsx`, `hooks/useMembers.ts`
- **Description:** Deletes a member from the workspace and disassociates them from any assigned projects and tasks. Admin only.
- **User Actions:** Click "Remove Member" button, confirm action.
- **Input Fields:** None.
- **Displayed Data:** Warning prompt and removal toast.
- **Current Data Source:** Next.js API `/api/members/[id]` (DELETE)
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `DELETE /api/v1/members/{id}`

---

### 1.6 Analytics Dashboard

#### Feature: Analytics & Charts Overview
- **File Location:** `pages/analytics.tsx`, `hooks/useAnalyticsData.ts`, `utils/analyticsTransformations.ts`
- **Description:** Aggregated visualizations showing project delivery velocity and workload.
- **User Actions:** Select project filter dropdown ("All Projects" or specific project).
- **Input Fields:** Project filter select dropdown.
- **Displayed Data:**
  1. **Task Status Distribution (Pie Chart):** Percentage breakdown of `backlog`, `todo`, `in_progress`, and `done`.
  2. **Workload by Assignee (Bar Chart):** Number of assigned tasks per team member.
  3. **7-Day Completion Velocity (Line Chart):** Daily completed task counts over time.
- **Current Data Source:** Next.js API `/api/analytics/data` (raw tasks + members processed client-side).
- **Implementation Status:** Fully Implemented in UI.
- **Backend API Required:** `GET /api/v1/analytics/overview?project_id={id|all}`
