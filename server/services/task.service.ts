import type { ProjectActivity } from "@/types/project";
import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "@/types/task";
import { db } from "../database/db";
import { projectRepository } from "../repositories/project.repository";
import { taskRepository } from "../repositories/task.repository";
import { userRepository } from "../repositories/user.repository";

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

    if (!input.projectId || !input.projectId.trim()) {
      throw new Error("Cannot create task: Project ID is required.");
    }

    const targetProject = projectRepository.findById(input.projectId);
    if (!targetProject) {
      throw new Error("Cannot create task: Selected project does not exist.");
    }
    if (targetProject.status === "archived") {
      throw new Error("Cannot create task: Target project is archived.");
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
      throw new Error("Task not found");
    }

    const isAdmin = !userRole || userRole.toLowerCase() === "admin";
    const isAssignedMember =
      Boolean(userId) && existingTask.assigneeId === userId;
    const hasAccess = isAdmin || isAssignedMember;

    if (!hasAccess) {
      throw new Error(
        "Forbidden: Only Admin or the assigned team member can update this task status.",
      );
    }

    if (input.status) {
      const currentStatusNorm = (existingTask.status || "").toLowerCase();
      const targetStatusNorm = input.status.toLowerCase();
      if (
        currentStatusNorm === "todo" &&
        (targetStatusNorm === "done" || targetStatusNorm === "completed")
      ) {
        throw new Error(
          "Task must be moved to In Progress before it can be completed.",
        );
      }
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
      throw new Error("Failed to update task");
    }
    const finalTask = updated;

    if (input.status && input.status !== existingTask.status) {
      const activeUser = userId ? userRepository.findById(userId) : undefined;
      const userName =
        activeUser?.name ||
        (userRole?.toLowerCase() === "admin" ? "System Admin" : "Team Member");
      const activity: ProjectActivity = {
        id: crypto.randomUUID(),
        projectId: finalTask.projectId,
        taskId: finalTask.id,
        taskTitle: finalTask.title,
        userId: userId || "550e8400-e29b-41d4-a716-446655440000",
        userName,
        fromStatus: existingTask.status,
        toStatus: input.status,
        createdAt: new Date().toISOString(),
      };
      db.addProjectActivity(activity);
    }

    return finalTask;
  },

  deleteTask(taskId: string, userRole?: string, userId?: string): void {
    if (userRole && userRole.toLowerCase() !== "admin") {
      const task = taskRepository.findById(taskId);
      if (task) {
        const project = projectRepository.findById(task.projectId);
        const isMember = project?.memberIds.includes(userId || "");
        if (!isMember && task.assigneeId !== userId) {
          throw new Error(
            "Forbidden: Only Admins or project members can delete tasks",
          );
        }
      }
    }

    taskRepository.delete(taskId);
  },
};
