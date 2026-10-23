# PROJECT_OVERVIEW.md

## 1. Executive Summary

**Team Hub** is a collaborative project management and team workspace platform. The existing frontend is developed using **Next.js (Pages Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **TanStack React Query v5**, **Zustand**, and **Recharts**.

The application currently operates with a local mock persistence layer based on a flat JSON file (`data/db.json`) handled by simulated server repositories. This document sets the architectural foundation for transitioning the platform to a separate, production-grade backend powered by:
- **FastAPI** (Python 3.11+)
- **PostgreSQL** with **SQLAlchemy 2.0 (Async)**
- **Alembic** (Database schema migrations)
- **Redis** (Session invalidation & query caching)
- **pytest** (Comprehensive async test suite)

---

## 2. Technology Stack Breakdown

### Frontend (Existing)
| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (Pages Router) | `16.3.4` | Application routing, SSR/SSG, middleware |
| **UI Library** | React | `19.2.8` | Component rendering and client state |
| **Language** | TypeScript | `^5` | Strict type safety across components and schemas |
| **Styling** | Tailwind CSS / PostCSS | `^4` | Utility-first styling & layout design |
| **State Management** | Zustand | `^5.0.15` | Global auth state & client-side filtering |
| **Server State / Cache** | TanStack React Query | `^5.102.8` | Data fetching, auto-refetch, and mutation cache |
| **Forms & Validation** | React Hook Form + Zod | `^7.87.0` / `^4.5.4` | Input validation and form state handling |
| **Charts** | Recharts | `^3.10.1` | Analytics and dashboard visualization |
| **Authentication** | NextAuth.js | `^4.24.15` | JWT session management & credentials provider |

### Backend (Target Stack)
| Component | Technology | Version / Spec | Purpose |
|---|---|---|---|
| **API Framework** | FastAPI | `^0.115.0` | Async high-performance RESTful API |
| **Database** | PostgreSQL | `16+` | Relational data persistence with strict foreign keys |
| **ORM** | SQLAlchemy (Asyncio) | `^2.0.35` | Async DB mapping and connection pooling |
| **Database Driver** | `asyncpg` | `^0.29.0` | Non-blocking PostgreSQL driver |
| **Migrations** | Alembic | `^1.13.0` | Version-controlled schema migrations |
| **Caching & Invalidation** | Redis + `redis-py` | `^5.0.0` | Caching dashboard metrics & token revocation |
| **Testing** | pytest + `pytest-asyncio` + `httpx` | `^8.0.0` | Unit, integration, and security test automation |

---

## 3. Directory & File Organization

The existing repository directory layout and the purpose of each key folder:

```
capstone-project/
├── components/                      # Reusable UI presentation & business components
│   ├── ChangePasswordModal.tsx      # Forced/voluntary password change modal dialog
│   ├── ErrorLayout.tsx              # Generic layout for HTTP 401, 403, 404, 500 error pages
│   ├── InviteMemberModal.tsx        # Admin form for inviting team members
│   ├── MemberProfileModal.tsx       # Member profile view/edit & admin deletion modal
│   ├── MultiStepCreateTaskModal.tsx # Multi-step wizard to create tasks with assignees & tags
│   ├── MultiStepProjectModal.tsx    # Multi-step wizard to create/edit projects with preview
│   ├── ProtectedRoute.tsx           # Route authorization guard checking roles & auth state
│   ├── Sidebar.tsx                  # Collapsible navigation drawer with responsive tabs
│   ├── TaskDetailModal.tsx          # Comprehensive task inspect/update/delete modal
│   └── TopBar.tsx                   # Top navigation bar with active user profile & search
├── data/
│   └── db.json                      # Local JSON database file used by mock server
├── hooks/                           # React Query hooks orchestrating API requests
│   ├── useAnalyticsData.ts          # Queries for project task aggregation & metric transforms
│   ├── useDashboardData.ts          # Queries for role-tailored dashboard stats
│   ├── useLogin.ts                  # Mutation hook for login & password reset
│   ├── useMembers.ts                # CRUD hooks for workspace member management
│   ├── useProjectTasks.ts           # CRUD hooks for tasks & project activity streams
│   └── useProjects.ts               # CRUD hooks for projects & status changes
├── middleware.ts                    # Next.js Edge Middleware for protected route redirects
├── pages/                           # Application routes (Pages Router)
│   ├── 401.tsx, 403.tsx, 404.tsx, 500.tsx # Custom error boundary pages
│   ├── _app.tsx                     # React Query client provider & auth hydration bootstrapper
│   ├── analytics.tsx                # Visual analytics page (Bar, Pie, Line charts)
│   ├── dashboard.tsx                # Role-specific dashboard (Admin vs Member views)
│   ├── index.tsx                    # Root redirection handler to /login
│   ├── login.tsx                    # Login view with demo credentials and error notifications
│   ├── members.tsx                  # Workspace member directory table & mobile cards
│   ├── projects.tsx                 # Projects directory with search, filter & lifecycle controls
│   ├── projects/[id].tsx            # Project details: Kanban board, task list, & activity log
│   └── api/                         # Current Next.js API Routes (Simulated backend)
├── schemas/                         # Zod validation schemas
│   ├── auth.schema.ts               # LoginCredentials & ChangePassword validation
│   ├── member.schema.ts             # InviteMember schema
│   ├── project.schema.ts            # CreateProject & UpdateProject schemas
│   └── task.schema.ts               # CreateTask & UpdateTask schemas
├── server/                          # Simulation server layer
│   ├── database/                    # Disk persistence engine (`db.ts`, `seed.ts`)
│   ├── repositories/                # Abstraction layer for users, projects, tasks
│   ├── services/                    # Business rules and authorization logic
│   └── utils/auth.ts                # Session extractor & header parser (`x-user-role`, `x-user-id`)
├── store/                           # Zustand client store
│   ├── authSlice.ts                 # User authentication persistence (`localStorage`)
│   ├── filterSlice.ts               # Filter state for projects & tasks
│   ├── uiSlice.ts                   # UI modal states & mobile sidebar toggles
│   └── index.ts                     # Root store integration
├── types/                           # TypeScript contract interfaces
│   ├── auth.ts                      # `User`, `UserRole`, `AuthState`, `InviteMemberInput`
│   ├── dashboard.ts                 # `AdminDashboardData`, `MemberDashboardData`, `ActivityItem`
│   ├── project.ts                   # `Project`, `ProjectStatus`, `ProjectActivity`
│   └── task.ts                      # `Task`, `TaskStatus`, `TaskPriority`, `TaskFilters`
└── utils/                           # Helper calculations & transformations
    ├── analyticsTransformations.ts  # Raw task aggregation for Recharts components
    └── projectUtils.ts              # Status transition logic & styling badges
```

---

## 4. Current State vs Target Architecture

```
CURRENT STATE (MOCK / NEXT.JS RUNTIME)
┌────────────────────────────────────────────────────────┐
│  Next.js Frontend (React 19 / Pages Router)            │
│  - Zustand (Auth + Filter State)                       │
│  - TanStack React Query Hooks                          │
└───────────┬────────────────────────────────────────────┘
            │  HTTP Fetch (Headers: x-user-role, x-user-id)
            ▼
┌────────────────────────────────────────────────────────┐
│  Next.js API Routes (/pages/api/*)                     │
│  - NextAuth JWT Callback                               │
│  - PersistentDatabase (server/database/db.ts)          │
│  - File I/O: data/db.json                              │
└────────────────────────────────────────────────────────┘

TARGET PRODUCTION ARCHITECTURE (DECOUPLED)
┌────────────────────────────────────────────────────────┐
│  Next.js Frontend (Pure SPA / Static Export / SSR)     │
│  - TanStack React Query + Zustand                      │
│  - Auth: Authorization: Bearer <JWT>                   │
└───────────┬────────────────────────────────────────────┘
            │  HTTPS REST Calls
            ▼
┌────────────────────────────────────────────────────────┐
│  FastAPI Backend (Python 3.11+ / Uvicorn)              │
│  - Dependencies: get_current_user, require_role        │
│  - Pydantic v2 Models (Request / Response validation)  │
│  - SQLAlchemy 2.0 Async Session                        │
└─────┬────────────────────────────────────────────┬─────┘
      │ Async SQL (asyncpg)                        │ Cache / Sessions
      ▼                                            ▼
┌───────────────────────┐                    ┌───────────┐
│  PostgreSQL 16        │                    │   Redis   │
│  - Users, Projects    │                    │ - Stats   │
│  - ProjectMembers     │                    │ - Black-  │
│  - Tasks, Activities  │                    │   list    │
└───────────────────────┘                    └───────────┘
```
