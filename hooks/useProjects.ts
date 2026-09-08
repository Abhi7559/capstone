import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "@/types/project";

const DEFAULT_ROLE = "admin";
const DEFAULT_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

async function fetchProjects(
  userRole?: string,
  userId?: string,
): Promise<Project[]> {
  const role = userRole || DEFAULT_ROLE;
  const id = userId || DEFAULT_USER_ID;

  const response = await fetch("/api/projects", {
    headers: {
      "x-user-role": role,
      "x-user-id": id,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch projects from server");
  }

  return response.json();
}

async function createProjectRequest(
  input: CreateProjectInput,
  userRole?: string,
  userId?: string,
): Promise<Project> {
  const role = userRole || DEFAULT_ROLE;
  const id = userId || DEFAULT_USER_ID;

  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": role,
      "x-user-id": id,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to create project on server.");
  }

  return response.json();
}

async function updateProjectRequest(
  id: string,
  input: UpdateProjectInput,
  userRole?: string,
  userId?: string,
): Promise<Project> {
  const role = userRole || DEFAULT_ROLE;
  const uId = userId || DEFAULT_USER_ID;

  const response = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": role,
      "x-user-id": uId,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to update project on server.");
  }

  return response.json();
}

async function deleteProjectRequest(
  id: string,
  userRole?: string,
  userId?: string,
): Promise<{ message: string }> {
  const role = userRole || DEFAULT_ROLE;
  const uId = userId || DEFAULT_USER_ID;

  const response = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
    headers: {
      "x-user-role": role,
      "x-user-id": uId,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Failed to delete project on server.");
  }

  return response.json();
}

export function useProjects() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const role = currentUser?.role || DEFAULT_ROLE;
  const userId = currentUser?.id || DEFAULT_USER_ID;

  return useQuery({
    queryKey: ["projects", userId],
    queryFn: () => fetchProjects(role, userId),
    enabled: true,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      createProjectRequest(
        input,
        currentUser?.role || DEFAULT_ROLE,
        currentUser?.id || DEFAULT_USER_ID,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
    },
  });

  return {
    createProject: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    reset: mutation.reset,
  };
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      updateProjectRequest(
        id,
        input,
        currentUser?.role || DEFAULT_ROLE,
        currentUser?.id || DEFAULT_USER_ID,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
    },
  });

  return {
    updateProject: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (id: string) =>
      deleteProjectRequest(
        id,
        currentUser?.role || DEFAULT_ROLE,
        currentUser?.id || DEFAULT_USER_ID,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      queryClient.invalidateQueries({ queryKey: ["analyticsData"] });
    },
  });

  return {
    deleteProject: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}
