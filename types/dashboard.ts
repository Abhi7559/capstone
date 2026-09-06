import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

export interface ActivityItem {
  id: string;
  type: "task_created" | "task_updated" | "project_created" | "member_invited";
  message: string;
  timestamp: string;
}

export interface AdminDashboardData {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  recentlyCreatedTasks: Task[];
  recentActivity: ActivityItem[];
}

export interface MemberDashboardData {
  myAssignedTasks: Task[];
  myOverdueTasks: Task[];
  tasksDueSoon: Task[];
  myProjects: Project[];
  recentActivity: ActivityItem[];
}
