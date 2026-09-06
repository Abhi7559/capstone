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
      userRole === "admin" ||
      (project.memberIds && project.memberIds.includes(userId));
    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this project");
    }
    return project;
  },

  createProject(
    input: CreateProjectInput,
    userRole?: string,
    userId?: string,
  ): Project {
    if (userRole !== "admin") {
      throw new Error("Forbidden: Only Admins can create projects");
    }

    const assignedMembers =
      input.memberIds && input.memberIds.length > 0
        ? [...input.memberIds]
        : [];
    if (userId && !assignedMembers.includes(userId)) {
      assignedMembers.push(userId);
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description.trim(),
      status: "active",
      createdAt: new Date().toISOString(),
      memberIds: assignedMembers,
    };

    return projectRepository.create(newProject);
  },

  updateProject(
    id: string,
    input: UpdateProjectInput,
    userRole?: string,
  ): Project {
    const existing = projectRepository.findById(id);
    if (!existing) {
      throw new Error("Project not found");
    }

    const updated = projectRepository.update(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.status && { status: input.status }),
      ...(input.memberIds && { memberIds: input.memberIds }),
    });

    if (!updated) {
      throw new Error("Project not found");
    }

    return updated;
  },

  archiveProject(id: string, userRole?: string): Project {
    const updated = projectRepository.update(id, { status: "archived" });
    if (!updated) {
      throw new Error("Project not found");
    }

    return updated;
  },

  deleteProject(id: string, userRole?: string): void {
    const success = projectRepository.delete(id);
    if (!success) {
      throw new Error("Project not found");
    }
  },
};
