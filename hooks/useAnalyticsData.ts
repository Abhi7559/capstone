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
  const role = userRole || "admin";
  const id = userId || "550e8400-e29b-41d4-a716-446655440000";

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

export function useAnalyticsData() {
  const currentUser = useAuthStore((state) => state.currentUser);

  const query = useQuery({
    queryKey: ["analyticsData", currentUser?.id, currentUser?.role],
    queryFn: () => fetchAnalyticsData(currentUser?.role, currentUser?.id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const rawData = query.data;

  const tasksByStatus = rawData ? transformTasksByStatus(rawData.tasks) : [];

  const tasksByAssignee = rawData
    ? transformTasksByAssignee(rawData.tasks, rawData.members)
    : [];

  const completionTrend = rawData
    ? transformCompletionTrend(rawData.tasks)
    : [];

  const hasTasks = Boolean(rawData && rawData.tasks.length > 0);

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
