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
    userRole?: string,
  ): Project {
    const existing = projectRepository.findById(id);
    if (!existing) {
      const createdProject: Project = {
        id,
        name: input.name?.trim() || "Untitled Project",
        description: input.description?.trim() || "",
        status: input.status || "active",
        createdAt: new Date().toISOString(),
        memberIds: input.memberIds || [],
        startDate: input.startDate,
        dueDate: input.dueDate || input.endDate,
        endDate: input.endDate || input.dueDate,
      };
      return projectRepository.create(createdProject);
    }

    const updated = projectRepository.update(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.status && { status: input.status }),
      ...(input.memberIds && { memberIds: input.memberIds }),
      ...(input.startDate && { startDate: input.startDate }),
      ...(input.dueDate && { dueDate: input.dueDate }),
      ...(input.endDate && { endDate: input.endDate }),
    });

    if (!updated) {
      const fallbackProject: Project = {
        id,
        name: input.name?.trim() || existing.name,
        description: input.description?.trim() || existing.description,
        status: input.status || existing.status,
        createdAt: existing.createdAt || new Date().toISOString(),
        memberIds: input.memberIds || existing.memberIds || [],
        startDate: input.startDate || existing.startDate,
        dueDate: input.dueDate || input.endDate || existing.dueDate,
        endDate: input.endDate || input.dueDate || existing.endDate,
      };
      return projectRepository.create(fallbackProject);
    }

    return updated;
  },

  archiveProject(id: string, userRole?: string): Project {
    const updated = projectRepository.update(id, { status: "archived" });
    if (!updated) {
      const existing = projectRepository.findById(id);
      const archived: Project = {
        id,
        name: existing?.name || "Archived Project",
        description: existing?.description || "",
        status: "archived",
        createdAt: existing?.createdAt || new Date().toISOString(),
        memberIds: existing?.memberIds || [],
      };
      return projectRepository.create(archived);
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
