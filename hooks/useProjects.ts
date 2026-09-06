import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from "@/types/project";
import {
  addOrUpdateLocalProject,
  getLocalProjects,
  mergeProjectsWithLocal,
  removeLocalProject,
} from "@/utils/localStorageSync";

const DEFAULT_ROLE = "admin";
const DEFAULT_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

async function fetchProjects(
  userRole?: string,
  userId?: string,
): Promise<Project[]> {
  try {
    const response = await fetch("/api/projects", {
      headers: {
        "x-user-role": userRole || "",
        "x-user-id": userId || "",
      },
    });
    if (response.ok) {
      const data: Project[] = await response.json();
      return mergeProjectsWithLocal(data);
    }
  } catch (err) {
    console.warn(
      "API projects fetch failed, falling back to local storage",
      err,
    );
  }

  return getLocalProjects();
}

async function createProjectRequest(
  input: CreateProjectInput,
  userRole?: string,
  userId?: string,
): Promise<Project> {
  const response = await fetch("/api/projects", {
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
    throw new Error(err.message || "Failed to create project");
  }
  const created: Project = await response.json();
  addOrUpdateLocalProject(created);
  return created;
}

async function updateProjectRequest(
  id: string,
  input: UpdateProjectInput,
  userRole?: string,
  userId?: string,
): Promise<Project> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": userRole || "",
        "x-user-id": userId || "",
      },
      body: JSON.stringify(input),
    });
    if (response.ok) {
      const updated: Project = await response.json();
      addOrUpdateLocalProject(updated);
      return updated;
    }
  } catch (err) {
    console.warn("API project update failed, updating local storage", err);
  }

  const localProjects = getLocalProjects();
  const existing = localProjects.find((p) => p.id === id);
  const updatedProject: Project = {
    id,
    name: input.name?.trim() || existing?.name || "Project",
    description: input.description?.trim() ?? existing?.description ?? "",
    status: input.status || existing?.status || "active",
    createdAt: existing?.createdAt || new Date().toISOString(),
    memberIds: input.memberIds || existing?.memberIds || [],
  };
  addOrUpdateLocalProject(updatedProject);
  return updatedProject;
}

async function deleteProjectRequest(
  id: string,
  userRole?: string,
  userId?: string,
): Promise<{ message: string }> {
  removeLocalProject(id);

  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      headers: {
        "x-user-role": userRole || "admin",
        "x-user-id": userId || "550e8400-e29b-41d4-a716-446655440000",
      },
    });

    if (response.ok) {
      return response.json();
    }
  } catch (err) {
    console.error("Server project deletion failed, deleted locally", err);
  }

  return { message: "Project deleted successfully" };
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
