import type { TaskStatus } from "./task";

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "archived";

// Matches the backend KanbanColumnSchema (camelCase from FastAPI)
export interface KanbanColumnDef {
  id: string;
  label: string;
  status: string;
  color: string;
  isCustom: boolean;
}

export interface Project {
  id: string; // UUID string
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string; // ISO date string
  memberIds: string[]; // UUIDs of assigned members
  startDate?: string;
  dueDate?: string;
  endDate?: string;
  category?: string;
  priority?: string;
  previousStatus?: ProjectStatus;
  /** Persisted Kanban column config. Empty array = use frontend defaults. */
  kanbanColumns?: KanbanColumnDef[];
}

export interface CreateProjectInput {
  name: string;
  description: string;
  status?: ProjectStatus;
  memberIds?: string[];
  startDate?: string;
  dueDate?: string;
  endDate?: string;
  category?: string;
  priority?: string;
  previousStatus?: ProjectStatus;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  memberIds?: string[];
  startDate?: string;
  dueDate?: string;
  endDate?: string;
  category?: string;
  priority?: string;
  previousStatus?: ProjectStatus;
  /** Send this to persist column order/config to the database. */
  kanbanColumns?: KanbanColumnDef[];
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  createdAt: string;
}
