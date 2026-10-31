import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types/auth";
import type { Task } from "@/types/task";
import {
  type AssigneeWorkloadData,
  type CompletionTrendData,
  type StatusChartData,
  transformCompletionTrend,
  transformTasksByAssignee,
  transformTasksByStatus,
} from "@/utils/analyticsTransformations";
import { apiEndpoint, getAuthHeaders } from "@/utils/apiConfig";

export interface StatusDistributionItem {
  name: string;
  value: number;
  color?: string;
}

export interface AssigneeDistributionItem {
  assignee: string;
  name?: string;
  count?: number;
  tasksCount?: number;
  tasks_count?: number;
}

export interface CompletionTrendItem {
  date: string;
  completed?: number;
  completedCount?: number;
  completed_count?: number;
}

export interface RawAnalyticsData {
  tasks?: Task[];
  members?: User[];
  statusDistribution?: StatusDistributionItem[];
  tasksByAssignee?: AssigneeDistributionItem[];
  completionTrends?: CompletionTrendItem[];
  status_distribution?: StatusDistributionItem[];
  tasks_by_assignee?: AssigneeDistributionItem[];
  completion_trends?: CompletionTrendItem[];
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "To Do": "#64748b",
  Todo: "#64748b",
  "In Progress": "#3b82f6",
  Done: "#22c55e",
};

/**
 * Format ISO YYYY-MM-DD to a short readable date label e.g. "Oct 24"
 */
function formatTrendDate(dateStr: string): string {
  if (!dateStr) return "";
  if (!dateStr.includes("-")) return dateStr;
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  } catch {
    // fallback to original string
  }
  return dateStr;
}

async function fetchAnalyticsData(
  userRole?: string,
  userId?: string,
  selectedProjectId?: string,
): Promise<RawAnalyticsData> {
  const role = userRole || "";
  const id = userId || "";

  const queryParams = new URLSearchParams();
  if (selectedProjectId && selectedProjectId !== "all") {
    queryParams.append("projectId", selectedProjectId);
  }
  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/analytics/data?${queryString}`
    : "/analytics/data";

  const response = await fetch(apiEndpoint(endpoint), {
    headers: getAuthHeaders({
      "x-user-role": role,
      "x-user-id": id,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch analytics from server");
  }

  const data = await response.json();
  return data;
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
    queryFn: () =>
      fetchAnalyticsData(currentUser?.role, currentUser?.id, selectedProjectId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const rawData = query.data;

  // Detect whether backend returned server-aggregated Recharts data (FastAPI) or raw arrays (Next.js mock)
  const isServerAggregated = Boolean(
    rawData &&
      ((rawData.statusDistribution && rawData.statusDistribution.length > 0) ||
        (rawData.status_distribution &&
          rawData.status_distribution.length > 0) ||
        rawData.tasksByAssignee ||
        rawData.tasks_by_assignee ||
        rawData.completionTrends ||
        rawData.completion_trends),
  );

  let tasksByStatus: StatusChartData[] = [];
  let tasksByAssignee: AssigneeWorkloadData[] = [];
  let completionTrend: CompletionTrendData[] = [];
  let hasTasks = false;

  if (rawData) {
    if (isServerAggregated) {
      const rawStatuses =
        rawData.statusDistribution || rawData.status_distribution || [];
      const rawAssignees =
        rawData.tasksByAssignee || rawData.tasks_by_assignee || [];
      const rawTrends =
        rawData.completionTrends || rawData.completion_trends || [];

      tasksByStatus = rawStatuses.map((item) => ({
        name: item.name,
        value: item.value ?? 0,
        color: item.color || DEFAULT_STATUS_COLORS[item.name] || "#64748b",
      }));

      tasksByAssignee = rawAssignees.map((item) => ({
        name:
          item.name ||
          item.assignee?.split(" ")[0] ||
          item.assignee ||
          "Unassigned",
        tasksCount: item.tasksCount ?? item.tasks_count ?? item.count ?? 0,
      }));

      completionTrend = rawTrends.map((item) => ({
        date: formatTrendDate(item.date),
        completedCount:
          item.completedCount ?? item.completed_count ?? item.completed ?? 0,
      }));

      const totalTasksInStatus = tasksByStatus.reduce(
        (acc, curr) => acc + curr.value,
        0,
      );
      const totalTasksInAssignees = tasksByAssignee.reduce(
        (acc, curr) => acc + curr.tasksCount,
        0,
      );

      hasTasks = totalTasksInStatus > 0 || totalTasksInAssignees > 0;
    } else if (rawData.tasks) {
      // Legacy Next.js mock API format
      const filteredTasks =
        selectedProjectId && selectedProjectId !== "all"
          ? rawData.tasks.filter((t) => t.projectId === selectedProjectId)
          : rawData.tasks;

      tasksByStatus = transformTasksByStatus(filteredTasks);
      tasksByAssignee = transformTasksByAssignee(
        filteredTasks,
        rawData.members || [],
      );
      completionTrend = transformCompletionTrend(filteredTasks);
      hasTasks = filteredTasks.length > 0;
    }
  }

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
