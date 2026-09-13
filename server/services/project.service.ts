import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "@/types/project";
import { projectRepository } from "../repositories/project.repository";

export const projectServiceServer = {
  getProjects(userRole?: string, userId?: string): Project[] {
    if (!userId) {
      throw new Error("Unauthorized: User session required");
    }

    if (userRole === "admin") {
      return projectRepository.findAll();
    }

    return projectRepository.findByMemberId(userId);
  },

  getProjectById(id: string, userRole?: string, userId?: string): Project {
    if (!userId) {
      throw new Error("Unauthorized: User session required");
    }
    const project = projectRepository.findById(id);
    if (!project) {
      throw new Error("Project not found");
    }
    const hasAccess =
      userRole === "admin" || project.memberIds?.includes(userId);
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this project");
    }
    return project;
  },

  createProject(
    input: CreateProjectInput,
    userRole?: string,
    _userId?: string,
  ): Project {
    if (userRole !== "admin") {
      throw new Error("Forbidden: Only Admins can create projects");
    }

    const assignedMembers =
      input.memberIds && input.memberIds.length > 0 ? [...input.memberIds] : [];

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: (input.description || "").trim(),
      status: input.status || "active",
      createdAt: new Date().toISOString(),
      memberIds: assignedMembers,
      startDate: input.startDate,
      dueDate: input.dueDate || input.endDate,
      endDate: input.endDate || input.dueDate,
    };

    return projectRepository.create(newProject);
  },

  updateProject(
    id: string,
    input: UpdateProjectInput,
    _userRole?: string,
  ): Project {
    const existing = projectRepository.findById(id);
    if (!existing) {
      throw new Error("Project not found");
    }

    let previousStatus = input.previousStatus;
    if (
      input.status === "archived" &&
      existing.status !== "archived" &&
      !previousStatus
    ) {
      previousStatus = existing.status;
    } else if (
      input.status &&
      input.status !== "archived" &&
      existing.status === "archived"
    ) {
      previousStatus = undefined;
    }

    const updated = projectRepository.update(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.description !== undefined && {
        description: input.description.trim(),
      }),
      ...(input.status && { status: input.status }),
      ...(input.memberIds && { memberIds: input.memberIds }),
      ...(input.startDate && { startDate: input.startDate }),
      ...(input.dueDate && { dueDate: input.dueDate }),
      ...(input.endDate && { endDate: input.endDate }),
      ...(input.category && { category: input.category }),
      ...(input.priority && { priority: input.priority }),
      previousStatus: previousStatus,
    });

    if (!updated) {
      throw new Error("Failed to update project");
    }

    return updated;
  },

  archiveProject(id: string, _userRole?: string): Project {
    const existing = projectRepository.findById(id);
    if (!existing) {
      throw new Error("Project not found");
    }

    const previousStatus =
      existing.status !== "archived"
        ? existing.status
        : existing.previousStatus;

    const updated = projectRepository.update(id, {
      status: "archived",
      previousStatus: previousStatus,
    });
    if (!updated) {
      throw new Error("Failed to archive project");
    }

    return updated;
  },

  deleteProject(id: string, userRole?: string): void {
    if (userRole && userRole.toLowerCase() !== "admin") {
      throw new Error("Forbidden: Only admin can delete projects");
    }
    projectRepository.delete(id);
  },
};
