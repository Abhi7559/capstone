import type { User } from "@/types/auth";
import type { Task } from "@/types/task";

export interface StatusChartData {
  name: string;
  value: number;
  color: string;
}

export interface AssigneeWorkloadData {
  name: string;
  tasksCount: number;
}

export interface CompletionTrendData {
  date: string;
  completedCount: number;
}

export interface AnalyticsRawPayload {
  tasks: Task[];
  members: User[];
}

/**
 * Transforms raw task & member datasets into PieChart data structure (Tasks by Status)
 */
export function transformTasksByStatus(tasks: Task[]): StatusChartData[] {
  const statusCounts: Record<string, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    done: 0,
  };

  for (const t of tasks) {
    if (t.status in statusCounts) {
      statusCounts[t.status]++;
    } else {
      statusCounts[t.status] = 1;
    }
  }

  return [
    { name: "Backlog", value: statusCounts.backlog || 0, color: "#94a3b8" },
    { name: "Todo", value: statusCounts.todo || 0, color: "#64748b" },
    {
      name: "In Progress",
      value: statusCounts.in_progress || 0,
      color: "#3b82f6",
    },
    { name: "Done", value: statusCounts.done || 0, color: "#22c55e" },
  ];
}

/**
 * Transforms raw task & member datasets into BarChart data structure (Workload per Member)
 */
export function transformTasksByAssignee(
  tasks: Task[],
  members: User[],
): AssigneeWorkloadData[] {
  const map: Record<string, number> = {};

  for (const m of members) {
    map[m.id] = 0;
  }

  for (const t of tasks) {
    if (t.assigneeId in map) {
      map[t.assigneeId]++;
    } else {
      map[t.assigneeId] = 1;
    }
  }

  return members.map((m) => ({
    name: m.name.split(" ")[0] || m.name,
    tasksCount: map[m.id] || 0,
  }));
}

/**
 * Transforms task datasets into LineChart trend data structure (Completion Trend over time)
 */
export function transformCompletionTrend(tasks: Task[]): CompletionTrendData[] {
  // Generate date labels for past 7 days
  const result: CompletionTrendData[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const displayLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Count tasks updated to DONE on or before this date
    const count = tasks.filter(
      (t) => t.status === "done" && t.updatedAt.split("T")[0] <= dateStr,
    ).length;

    result.push({
      date: displayLabel,
      completedCount: count,
    });
  }

  return result;
}
