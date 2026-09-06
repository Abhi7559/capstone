import type { Task, TaskFilters } from "@/types/task";
import { db } from "../database/db";

export const taskRepository = {
  findAll(): Task[] {
    return db.getTasks();
  },

  findById(id: string): Task | undefined {
    return db.findTaskById(id);
  },

  findByProjectId(projectId: string, filters?: TaskFilters): Task[] {
    let tasks = db.getTasks().filter((t) => t.projectId === projectId);

    if (filters) {
      if (filters.status && filters.status !== "all") {
        tasks = tasks.filter((t) => t.status === filters.status);
      }
      if (filters.priority && filters.priority !== "all") {
        tasks = tasks.filter((t) => t.priority === filters.priority);
      }
      if (filters.assigneeId && filters.assigneeId !== "all") {
        tasks = tasks.filter((t) => t.assigneeId === filters.assigneeId);
      }
      if (filters.dueDate) {
        tasks = tasks.filter((t) => t.dueDate === filters.dueDate);
      }
    }

    return tasks;
  },

  create(task: Task): Task {
    return db.addTask(task);
  },

  update(id: string, updatedFields: Partial<Task>): Task | undefined {
    return db.updateTask(id, updatedFields);
  },

  delete(id: string): boolean {
    return db.deleteTask(id);
  },
};
