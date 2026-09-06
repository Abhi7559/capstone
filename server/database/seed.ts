import type { User } from "@/types/auth";
import type { ActivityItem } from "@/types/dashboard";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

export const SEED_ADMIN: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "System Admin",
  email: "admin@teamboard.com",
  password: "Admin@123",
  role: "admin",
  status: "active",
  designation: "System Administrator",
  joiningDate: "2026-09-01",
};

export const INITIAL_USERS: User[] = [SEED_ADMIN];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    name: "Internal Task Board Development",
    description:
      "Frontend capstone task board application built with Next.js Pages Router and TanStack Query.",
    status: "active",
    createdAt: new Date().toISOString(),
    memberIds: ["550e8400-e29b-41d4-a716-446655440000"],
  },
  {
    id: "f8e7d6c5-b4a3-2f1e-0d9c-8b7a6f5e4d3c",
    name: "Design System Migration",
    description:
      "Standardize Tailwind styling, typography, and reusable component tokens.",
    status: "active",
    createdAt: new Date().toISOString(),
    memberIds: ["550e8400-e29b-41d4-a716-446655440000"],
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: "t1111111-1111-1111-1111-111111111111",
    projectId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    title: "Setup Pages Router & Layout",
    description:
      "Configure Next.js 14 Pages Router with Tailwind CSS and global style structure.",
    priority: "high",
    status: "done",
    assigneeId: "550e8400-e29b-41d4-a716-446655440000",
    dueDate: "2026-09-10",
    tags: ["Setup", "Frontend"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t2222222-2222-2222-2222-222222222222",
    projectId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    title: "Implement Mock Auth & Role Guards",
    description:
      "Add Zustand auth store, mock auth service, and ProtectedRoute wrappers for Admin/Member roles.",
    priority: "high",
    status: "in_progress",
    assigneeId: "550e8400-e29b-41d4-a716-446655440000",
    dueDate: "2026-09-15",
    tags: ["Auth", "Security"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t3333333-3333-3333-3333-333333333333",
    projectId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    title: "Task Kanban Board Filters",
    description:
      "Build filter controls by Status, Priority, and Assignee for project task boards.",
    priority: "medium",
    status: "todo",
    assigneeId: "550e8400-e29b-41d4-a716-446655440000",
    dueDate: "2026-09-20",
    tags: ["UI", "Tasks"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "t4444444-4444-4444-4444-444444444444",
    projectId: "f8e7d6c5-b4a3-2f1e-0d9c-8b7a6f5e4d3c",
    title: "Audit Typography Tokens",
    description:
      "Ensure font tokens are standardized across buttons, headers, and form labels.",
    priority: "low",
    status: "todo",
    assigneeId: "550e8400-e29b-41d4-a716-446655440000",
    dueDate: "2026-09-25",
    tags: ["DesignSystem"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_ACTIVITY: ActivityItem[] = [
  {
    id: "act-1",
    type: "task_updated",
    message: "Task 'Setup Pages Router & Layout' marked as DONE.",
    timestamp: "10 minutes ago",
  },
  {
    id: "act-2",
    type: "project_created",
    message: "Project 'Design System Migration' was created by Admin.",
    timestamp: "1 hour ago",
  },
  {
    id: "act-3",
    type: "member_invited",
    message: "New member was invited to the workspace.",
    timestamp: "3 hours ago",
  },
  {
    id: "act-4",
    type: "task_created",
    message: "Task 'Task Kanban Board Filters' was added to TODO.",
    timestamp: "Yesterday",
  },
];
