/**
 * API Configuration
 *
 * NEXT_PUBLIC_API_BASE_URL:
 * - If set in environment (e.g. "http://localhost:8000/task_management/api/v1" or Render URL),
 *   requests will go directly to the backend.
 * - If unset / empty, defaults to "" (or "/api"), making relative calls to the Next.js API layer.
 */
import { useAppStore } from "@/store";

function resolveApiBaseUrl(): string {
  const direct =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (direct) {
    return direct.replace(/\/$/, "");
  }

  const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (backendHost) {
    const cleanHost = backendHost.replace(/\/$/, "");
    if (cleanHost.includes("/task_management/api/v1")) {
      return cleanHost;
    }
    return `${cleanHost}/task_management/api/v1`;
  }

  return "/api";
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Helper to build complete API endpoints cleanly.
 * Example:
 *   apiEndpoint("/tasks") -> "/api/tasks" or "http://localhost:8000/task_management/api/v1/tasks"
 */
export function apiEndpoint(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Helper to attach standard Authorization headers with JWT token and fallback user identity.
 */
export function getAuthHeaders(
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  try {
    const state = useAppStore.getState();
    const token = state.currentUser?.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (state.currentUser?.role) {
      headers["x-user-role"] = state.currentUser.role;
    }
    if (state.currentUser?.id) {
      headers["x-user-id"] = state.currentUser.id;
    }
  } catch {
    // If called outside React / browser state
  }
  return headers;
}
