import type { User } from "@/types/auth";
import type { ActivityItem } from "@/types/dashboard";
import type { Project, ProjectActivity } from "@/types/project";
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

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_ACTIVITY: ActivityItem[] = [];

export const INITIAL_PROJECT_ACTIVITIES: ProjectActivity[] = [
  {
    id: "act-1",
    projectId: "8e50124d-efd2-414e-bbde-777f8d866480",
    taskId: "d4a9d1af-47bb-4fb4-b6c1-021b38ce5d70",
    taskTitle: "Task 1",
    userId: "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    userName: "Abhishek",
    fromStatus: "todo",
    toStatus: "in_progress",
    createdAt: "2026-09-10T10:30:00.000Z",
  },
  {
    id: "act-2",
    projectId: "8e50124d-efd2-414e-bbde-777f8d866480",
    taskId: "d4a9d1af-47bb-4fb4-b6c1-021b38ce5d70",
    taskTitle: "Task 1",
    userId: "b733e169-49d4-4d66-b4ef-2460da7a3a30",
    userName: "Abhishek",
    fromStatus: "in_progress",
    toStatus: "done",
    createdAt: "2026-09-10T12:12:00.000Z",
  },
];
