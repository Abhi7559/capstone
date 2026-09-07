export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "archived";

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
}
