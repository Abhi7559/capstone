import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types/auth";
import type { Task } from "@/types/task";
import {
  transformCompletionTrend,
  transformTasksByAssignee,
  transformTasksByStatus,
} from "@/utils/analyticsTransformations";

export interface RawAnalyticsData {
  tasks: Task[];
  members: User[];
}

async function fetchAnalyticsData(
  userRole?: string,
  userId?: string,
): Promise<RawAnalyticsData> {
  const role = userRole || "";
  const id = userId || "";

  const response = await fetch("/api/analytics/data", {
    headers: {
      "x-user-role": role,
      "x-user-id": id,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch analytics from server");
  }

  const data = await response.json();
  return {
    tasks: data.tasks || [],
    members: data.members || [],
  };
}

export function useAnalyticsData(selectedProjectId?: string) {
  const currentUser = useAuthStore((state) => state.currentUser);

  const query = useQuery({
    queryKey: [
      "analyticsData",
      currentUser?.id,
      currentUser?.role,
      selectedProjectId,
    ],
    queryFn: () => fetchAnalyticsData(currentUser?.role, currentUser?.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const rawData = query.data;

  // Filter tasks by selectedProjectId if specified ("all" or empty means All Projects)
  const filteredTasks = rawData
    ? selectedProjectId && selectedProjectId !== "all"
      ? rawData.tasks.filter((t) => t.projectId === selectedProjectId)
      : rawData.tasks
    : [];

  const tasksByStatus = transformTasksByStatus(filteredTasks);

  const tasksByAssignee = rawData
    ? transformTasksByAssignee(filteredTasks, rawData.members)
    : [];

  const completionTrend = transformCompletionTrend(filteredTasks);

  const hasTasks = Boolean(filteredTasks.length > 0);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ? (query.error as Error).message : null,
    hasTasks,
    tasksByStatus,
    tasksByAssignee,
    completionTrend,
    refetch: query.refetch,
  };
}
