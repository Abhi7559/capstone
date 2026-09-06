import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "@/types/task";
import { projectRepository } from "../repositories/project.repository";
import { taskRepository } from "../repositories/task.repository";

export const taskServiceServer = {
  getProjectTasks(
    projectId: string,
    filters?: TaskFilters,
    userRole?: string,
    userId?: string,
  ): Task[] {
    if (!userId || !userRole) {
      throw new Error("Unauthorized: Valid session required");
    }

    const project = projectRepository.findById(projectId);
    if (project) {
      const hasAccess =
        userRole === "admin" || project.memberIds.includes(userId);
      if (!hasAccess) {
        throw new Error(
          "Forbidden: You do not have access to this project's tasks.",
        );
      }
    }

    return taskRepository.findByProjectId(projectId, filters);
  },

  getAllTasks(userRole?: string, userId?: string): Task[] {
    if (!userId || !userRole) {
      throw new Error("Unauthorized: Valid session required");
    }

    const allTasks = taskRepository.findAll();
    if (userRole === "admin") {
      return allTasks;
    }

    const userProjectIds = projectRepository
      .findByMemberId(userId)
      .map((p) => p.id);
    return allTasks.filter((t) => userProjectIds.includes(t.projectId));
  },

  getTaskById(taskId: string, userRole?: string, userId?: string): Task {
    if (!userId || !userRole) {
      throw new Error("Unauthorized: Valid session required");
    }

    const task = taskRepository.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const project = projectRepository.findById(task.projectId);
    const hasAccess =
      userRole === "admin" || project?.memberIds.includes(userId);

    if (!hasAccess) {
      throw new Error("Forbidden: You do not have access to this task.");
    }

    return task;
  },

  createTask(input: CreateTaskInput, userRole?: string): Task {
    if (userRole !== "admin") {
      throw new Error("Forbidden: Admin privileges required to create tasks.");
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status: input.status || "todo",
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      tags: input.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return taskRepository.create(newTask);
  },

  updateTask(
    taskId: string,
    input: UpdateTaskInput,
    userRole?: string,
    userId?: string,
  ): Task {
    const existingTask = taskRepository.findById(taskId);
    if (!existingTask) {
      const createdTask: Task = {
        id: taskId,
        projectId: input.projectId || "",
        title: input.title?.trim() || "Untitled Task",
        description: input.description?.trim() || "",
        priority: input.priority || "medium",
        status: input.status || "todo",
        assigneeId: input.assigneeId || userId || "",
        dueDate: input.dueDate || new Date().toISOString().split("T")[0],
        tags: input.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return taskRepository.create(createdTask);
    }

    const isAdmin = !userRole || userRole.toLowerCase() === "admin";
    const isAssignedMember = Boolean(userId) && existingTask.assigneeId === userId;
    const hasAccess = isAdmin || isAssignedMember;

    if (!hasAccess) {
      throw new Error("Forbidden: Only Admin or the assigned team member can update this task status.");
    }

    const payload: Partial<Task> = {
      ...(input.projectId && { projectId: input.projectId }),
      ...(input.title && { title: input.title.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.priority && { priority: input.priority }),
      ...(input.status && { status: input.status }),
      ...(input.assigneeId && { assigneeId: input.assigneeId }),
      ...(input.dueDate && { dueDate: input.dueDate }),
      ...(input.tags && { tags: input.tags }),
    };

    const updated = taskRepository.update(taskId, payload);
    if (!updated) {
      const fallbackTask: Task = {
        ...existingTask,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      return taskRepository.create(fallbackTask);
    }

    return updated;
  },

  deleteTask(taskId: string, userRole?: string, userId?: string): void {
    if (userRole && userRole.toLowerCase() !== "admin") {
      const task = taskRepository.findById(taskId);
      if (task) {
        const project = projectRepository.findById(task.projectId);
        const isMember = project?.memberIds.includes(userId || "");
        if (!isMember && task.assigneeId !== userId) {
          throw new Error("Forbidden: Only Admins or project members can delete tasks");
        }
      }
    }

    taskRepository.delete(taskId);
  },
};
