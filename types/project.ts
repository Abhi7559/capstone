export type ProjectStatus = "active" | "archived" | "on_hold";

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
}

export interface CreateProjectInput {
  name: string;
  description: string;
  status?: ProjectStatus;
  memberIds?: string[];
  startDate?: string;
  dueDate?: string;
  endDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  memberIds?: string[];
  startDate?: string;
  dueDate?: string;
  endDate?: string;
}
