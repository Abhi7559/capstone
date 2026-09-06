import type {
  AdminDashboardData,
  MemberDashboardData,
} from "@/types/dashboard";
import { db } from "../database/db";
import { projectRepository } from "../repositories/project.repository";
import { taskRepository } from "../repositories/task.repository";

export const dashboardServiceServer = {
  getDashboardData(
    userRole?: string,
    userId?: string,
  ): AdminDashboardData | MemberDashboardData {
    if (!userId || !userRole) {
      throw new Error("Unauthorized: Active user session required.");
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const projects = projectRepository.findAll();
    const tasks = taskRepository.findAll();
    const activity = db.getActivity();

    if (userRole === "admin") {
      const totalProjects = projects.length;
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "done").length;
      const overdueTasks = tasks.filter(
        (t) => t.status !== "done" && t.dueDate < todayStr,
      ).length;

      const recentlyCreatedTasks = [...tasks]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5);

      return {
        totalProjects,
        totalTasks,
        completedTasks,
        overdueTasks,
        recentlyCreatedTasks,
        recentActivity: activity,
      };
    }

    // Member dashboard metrics
    const myAssignedTasks = tasks.filter((t) => t.assigneeId === userId);
    const myOverdueTasks = myAssignedTasks.filter(
      (t) => t.status !== "done" && t.dueDate < todayStr,
    );
    const tasksDueSoon = myAssignedTasks.filter(
      (t) => t.status !== "done" && t.dueDate >= todayStr,
    );
    const myProjects = projects.filter((p) => p.memberIds.includes(userId));

    return {
      myAssignedTasks,
      myOverdueTasks,
      tasksDueSoon,
      myProjects,
      recentActivity: activity,
    };
  },
};
