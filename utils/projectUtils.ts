import type { Project, ProjectStatus } from "@/types/project";

export type ProjectLifecycleAction = "archive" | "restore";

/**
 * Returns the lifecycle action for a given project status.
 * If status is "archived", the action is "restore" ("Restore Project").
 * Otherwise (active, planning, on_hold, completed), the action is "archive" ("Archive Project").
 */
export function getProjectLifecycleAction(
  status: ProjectStatus,
): ProjectLifecycleAction {
  return status === "archived" ? "restore" : "archive";
}

/**
 * Returns the human-readable action menu text for a project status.
 * e.g. "Restore Project" or "Archive Project"
 */
export function getProjectLifecycleActionLabel(status: ProjectStatus): string {
  return getProjectLifecycleAction(status) === "restore"
    ? "Restore Project"
    : "Archive Project";
}

/**
 * Calculates the next status when toggling archive/restore.
 * When archiving, moves to "archived" and saves existing status as previousStatus.
 * When restoring, restores to previousStatus or defaults to "active".
 */
export function getNextProjectStatus(project: Project): {
  status: ProjectStatus;
  previousStatus?: ProjectStatus;
} {
  if (project.status === "archived") {
    return {
      status: project.previousStatus || "active",
      previousStatus: undefined,
    };
  }
  return {
    status: "archived",
    previousStatus: project.status,
  };
}

/**
 * Formats a project status key into a clean, human-readable display string.
 * e.g. "on_hold" -> "On Hold", "archived" -> "Archived"
 */
export function formatProjectStatusLabel(status?: string): string {
  if (!status) return "";
  switch (status.toLowerCase()) {
    case "planning":
      return "Planning";
    case "active":
      return "Active";
    case "on_hold":
      return "On Hold";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
