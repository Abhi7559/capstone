import type { User } from "@/types/auth";
import type { Task } from "@/types/task";
import { projectRepository } from "../repositories/project.repository";
import { taskRepository } from "../repositories/task.repository";
import { userRepository } from "../repositories/user.repository";

export interface RawAnalyticsData {
  tasks: Task[];
  members: User[];
}

export const analyticsServiceServer = {
  getAnalyticsData(userRole?: string, userId?: string): RawAnalyticsData {
    const tasks = taskRepository.findAll();
    const members = userRepository
      .findAll()
      .map(({ password: _, ...u }) => u as User);

    const isAdmin = !userRole || userRole.toLowerCase() === "admin";
    if (isAdmin) {
      return { tasks, members };
    }

    const memberProjectIds = projectRepository
      .findByMemberId(userId || "")
      .map((p) => p.id);

    const accessibleTasks = tasks.filter(
      (t) =>
        memberProjectIds.includes(t.projectId) ||
        t.assigneeId === userId ||
        memberProjectIds.length === 0,
    );

    return {
      tasks: accessibleTasks,
      members,
    };
  },
};
