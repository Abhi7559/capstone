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

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_ACTIVITY: ActivityItem[] = [];
