import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  ActivityItem,
  AdminDashboardData,
  MemberDashboardData,
} from "@/types/dashboard";
import {
  getLocalProjects,
  getLocalTasks,
  mergeProjectsWithLocal,
  mergeTasksWithLocal,
} from "@/utils/localStorageSync";

async function fetchDashboardData(
  userRole?: string,
  userId?: string,
): Promise<AdminDashboardData | MemberDashboardData> {
  const todayStr = new Date().toISOString().split("T")[0];
  let apiActivity: ActivityItem[] = [];

  try {
    const response = await fetch("/api/dashboard/stats", {
      headers: {
        "x-user-role": userRole || "",
        "x-user-id": userId || "",
      },
    });

    if (response.ok) {
      const data = await response.json();
      apiActivity = data.recentActivity || [];
    }
  } catch (err) {
    console.warn(
      "API dashboard stats fetch failed, relying on local storage",
      err,
    );
  }

  const allProjects = mergeProjectsWithLocal(getLocalProjects());
  const allTasks = mergeTasksWithLocal(getLocalTasks());

  if (userRole === "admin") {
    const totalProjects = allProjects.length;
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "done").length;
    const overdueTasks = allTasks.filter(
      (t) =>
        t.status !== "done" &&
        Boolean(t.dueDate) &&
        (t.dueDate || "") < todayStr,
    ).length;

    const recentlyCreatedTasks = [...allTasks].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    return {
      totalProjects,
      totalTasks,
      completedTasks,
      overdueTasks,
      recentlyCreatedTasks,
      recentActivity: apiActivity,
    };
  }

  // Member Dashboard Data
  const myAssignedTasks = allTasks.filter((t) => t.assigneeId === userId);
  const myOverdueTasks = myAssignedTasks.filter(
    (t) =>
      t.status !== "done" && Boolean(t.dueDate) && (t.dueDate || "") < todayStr,
  );
  const tasksDueSoon = myAssignedTasks.filter(
    (t) => t.status !== "done" && (!t.dueDate || (t.dueDate || "") >= todayStr),
  );
  const myProjects = allProjects.filter((p) =>
    p.memberIds?.includes(userId || ""),
  );

  return {
    myAssignedTasks,
    myOverdueTasks,
    tasksDueSoon,
    myProjects,
    recentActivity: apiActivity,
  };
}

export function useDashboardData() {
  const currentUser = useAuthStore((state) => state.currentUser);

  return useQuery<AdminDashboardData | MemberDashboardData, Error>({
    queryKey: ["dashboardData", currentUser?.id, currentUser?.role],
    queryFn: () => fetchDashboardData(currentUser?.role, currentUser?.id),
    enabled: Boolean(currentUser),
  });
}
