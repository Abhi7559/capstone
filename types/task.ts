export type TaskStatus = "backlog" | "todo" | "in_progress" | "done" | string;
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string; // UUID string
  projectId: string; // UUID string of associated project
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId?: string; // UUID string of assigned User (optional)
  dueDate?: string; // YYYY-MM-DD format
  tags: string[];
  isDeleted?: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface TaskFilters {
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  assigneeId?: string | "all";
  dueDate?: string; // YYYY-MM-DD format for date filtering
  tag?: string | "all"; // Filter by tag
  includeDeleted?: boolean;
  deletedOnly?: boolean;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status?: TaskStatus;
  assigneeId?: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  projectId?: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeId?: string;
  dueDate?: string;
  tags?: string[];
}
