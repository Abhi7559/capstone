/**
 * API Configuration
 *
 * Provides standardized endpoint resolution and authorization headers
 * across both client-side React code and server-side Next.js route handlers.
 */
import { useAppStore } from "@/store";

export const DEFAULT_PRODUCTION_BACKEND = "https://teamhub-backend-p5a1.onrender.com";

/**
 * Sanitizes any backend URL string, safely handling accidental duplication,
 * legacy domains, and trailing slashes.
 */
export function cleanBackendUrl(raw?: string): string {
  if (!raw) return "";
  let url = raw.trim();

  // Handle accidental double-pasting (e.g. "https://abc.comhttps://abc.com")
  const secondHttp = url.indexOf("http", 4);
  if (secondHttp !== -1) {
    url = url.substring(0, secondHttp);
  }

  // Handle legacy/obsolete render domains
  if (url.includes("capstone-fr3d.onrender.com")) {
    url = DEFAULT_PRODUCTION_BACKEND;
  }

  return url.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const direct = cleanBackendUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL,
  );
  if (direct) {
    if (direct.includes("/task_management/api/v1")) {
      return direct;
    }
    return `${direct}/task_management/api/v1`;
  }

  const backendHost = cleanBackendUrl(
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_API_URL,
  );
  if (backendHost) {
    if (backendHost.includes("/task_management/api/v1")) {
      return backendHost;
    }
    return `${backendHost}/task_management/api/v1`;
  }

  // If in browser or production environment without explicit configuration, default to live backend
  if (
    typeof window !== "undefined" ||
    process.env.VERCEL ||
    process.env.NODE_ENV === "production"
  ) {
    return `${DEFAULT_PRODUCTION_BACKEND}/task_management/api/v1`;
  }

  return "/api";
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Resolves the raw backend host (e.g. "https://teamhub-backend-p5a1.onrender.com")
 * used by Next.js serverless API routes to reach FastAPI.
 */
export function getBackendHost(): string {
  const direct = cleanBackendUrl(process.env.BACKEND_API_URL);
  if (direct) return direct;

  const nextPublicBackend = cleanBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (nextPublicBackend) {
    return nextPublicBackend.replace(/\/task_management\/api\/v1\/?$/, "");
  }

  const nextPublicApi = cleanBackendUrl(
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL,
  );
  if (nextPublicApi) {
    return nextPublicApi.replace(/\/task_management\/api\/v1\/?$/, "");
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_BACKEND;
  }

  return "http://localhost:8000";
}

/**
 * Helper to build complete API endpoints cleanly.
 * Example:
 *   apiEndpoint("/tasks") -> "https://teamhub-backend-p5a1.onrender.com/task_management/api/v1/tasks"
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
