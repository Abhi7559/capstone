import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  CreateTaskInput,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "@/types/task";

async function fetchProjectTasks(
  projectId?: string,
  filters?: TaskFilters,
  userRole?: string,
  userId?: string,
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (projectId && projectId !== "all") {
    params.append("projectId", projectId);
  }
  if (filters?.status && filters.status !== "all") {
    params.append("status", filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    params.append("priority", filters.priority);
  }
  if (filters?.assigneeId && filters.assigneeId !== "all") {
    params.append("assigneeId", filters.assigneeId);
  }
  if (filters?.dueDate) {
    params.append("dueDate", filters.dueDate);
  }

  const response = await fetch(`/api/tasks?${params.toString()}`, {
    headers: {
      "x-user-role": userRole || "",
      "x-user-id": userId || "",
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to fetch tasks");
  }

  return response.json();
}

async function fetchTaskById(
  taskId: string,
  userRole?: string,
  userId?: string,
): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    headers: {
      "x-user-role": userRole || "",
      "x-user-id": userId || "",
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to fetch task");
  }

  return response.json();
}

async function createTaskRequest(
  input: CreateTaskInput,
  userRole?: string,
  userId?: string,
): Promise<Task> {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": userRole || "",
      "x-user-id": userId || "",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to create task");
  }

  return response.json();
}

async function updateTaskRequest(
  taskId: string,
  input: UpdateTaskInput,
  userRole?: string,
  userId?: string,
): Promise<Task> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": userRole || "",
      "x-user-id": userId || "",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to update task");
  }

  return response.json();
}

async function deleteTaskRequest(
  taskId: string,
  userRole?: string,
  userId?: string,
): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: "DELETE",
    headers: {
      "x-user-role": userRole || "",
      "x-user-id": userId || "",
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to delete task");
  }
}

export function useTasks(projectId?: string, filters?: TaskFilters) {
  const currentUser = useAuthStore((state) => state.currentUser);

  return useQuery({
    queryKey: ["projectTasks", projectId || "all", filters, currentUser?.id],
    queryFn: () =>
      fetchProjectTasks(
        projectId,
        filters,
        currentUser?.role,
        currentUser?.id,
      ),
    enabled: Boolean(currentUser),
  });
}

export const useProjectTasks = useTasks;

export function useTask(taskId: string) {
  const currentUser = useAuthStore((state) => state.currentUser);

  return useQuery({
    queryKey: ["task", taskId, currentUser?.id],
    queryFn: () =>
      fetchTaskById(taskId, currentUser?.role, currentUser?.id),
    enabled: Boolean(taskId) && Boolean(currentUser),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      createTaskRequest(input, currentUser?.role, currentUser?.id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["projectTasks", variables.projectId],
      });
    },
  });

  return {
    createTask: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    reset: mutation.reset,
  };
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) =>
      updateTaskRequest(taskId, input, currentUser?.role, currentUser?.id),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["task", updatedTask.id] });
      queryClient.invalidateQueries({
        queryKey: ["projectTasks", updatedTask.projectId],
      });
    },
  });

  return {
    updateTask: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    reset: mutation.reset,
  };
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (taskId: string) =>
      deleteTaskRequest(
        taskId,
        currentUser?.role || "admin",
        currentUser?.id || "550e8400-e29b-41d4-a716-446655440000",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
      queryClient.invalidateQueries({ queryKey: ["task"] });
    },
  });

  return {
    deleteTask: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}
