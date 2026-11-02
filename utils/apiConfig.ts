/**
 * API Configuration
 *
 * Provides standardized endpoint resolution and authorization headers
 * across both client-side React code and server-side Next.js route handlers.
 */
import { useAppStore } from "@/store";

export const DEFAULT_PRODUCTION_BACKEND = "https://teamhub-backend-p5a1.onrender.com";
export const ALTERNATIVE_BACKEND = "https://workstream-backend-1rr8.onrender.com";

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
  if (direct && !direct.includes("localhost:8000")) {
    if (direct.includes("/task_management/api/v1")) {
      return direct;
    }
    return `${direct}/task_management/api/v1`;
  }

  const backendHost = cleanBackendUrl(
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_API_URL,
  );
  if (backendHost && !backendHost.includes("localhost:8000")) {
    if (backendHost.includes("/task_management/api/v1")) {
      return backendHost;
    }
    return `${backendHost}/task_management/api/v1`;
  }

  return `${DEFAULT_PRODUCTION_BACKEND}/task_management/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Resolves the raw backend host (e.g. "https://teamhub-backend-p5a1.onrender.com")
 * used by Next.js serverless API routes to reach FastAPI.
 */
export function getBackendHost(): string {
  const direct = cleanBackendUrl(process.env.BACKEND_API_URL);
  if (direct && !direct.includes("localhost:8000")) return direct;

  const nextPublicBackend = cleanBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (nextPublicBackend && !nextPublicBackend.includes("localhost:8000")) {
    return nextPublicBackend.replace(/\/task_management\/api\/v1\/?$/, "");
  }

  const nextPublicApi = cleanBackendUrl(
    process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL,
  );
  if (nextPublicApi && !nextPublicApi.includes("localhost:8000")) {
    return nextPublicApi.replace(/\/task_management\/api\/v1\/?$/, "");
  }

  return DEFAULT_PRODUCTION_BACKEND;
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

/**
 * Extracts a user-friendly, descriptive error message from any backend API error response.
 * Safely traverses `detail`, `details`, `error.details`, `message`, and arrays of validation errors,
 * filtering out unhelpful generic HTTP status phrases (e.g. "Bad Request", "Internal Server Error").
 */
export function extractErrorMessage(errData: any, defaultMsg: string): string {
  if (!errData) return defaultMsg;

  // 1. Check for specific detailed errors (FastAPI / DomainException puts specific reasons here)
  const detail =
    errData?.detail ??
    errData?.details ??
    errData?.error?.details ??
    errData?.error?.message;

  if (typeof detail === "string" && detail.trim() !== "") {
    const trimmed = detail.trim();
    // User-friendly mappings for common backend exceptions
    if (/assignee is not a member/i.test(trimmed)) {
      return "The selected assignee is not a member of this project. Please select a valid project member or add them to the project first.";
    }
    if (/cannot create tasks in an archived project/i.test(trimmed)) {
      return "Cannot create tasks in an archived project. Please reactivate or unarchive the project first.";
    }
    if (/cannot delete an active project/i.test(trimmed)) {
      return "Cannot delete an active project. Please archive or change its status before deleting.";
    }
    return trimmed;
  }

  // If detail is an array (e.g. FastAPI / Pydantic validation errors)
  if (Array.isArray(detail) && detail.length > 0) {
    const parts = detail
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (item?.msg) {
          const field = Array.isArray(item?.loc)
            ? item.loc[item.loc.length - 1]
            : "";
          return field ? `${field}: ${item.msg}` : item.msg;
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join("; ");
    }
  }

  // 2. Check errData.message, avoiding generic HTTP status titles
  const genericPhrases = new Set([
    "bad request",
    "validation error",
    "internal server error",
    "error",
    "unauthorized",
    "forbidden",
    "not found",
    "conflict",
    "unprocessable entity",
  ]);

  if (typeof errData?.message === "string" && errData.message.trim() !== "") {
    const msg = errData.message.trim();
    if (!genericPhrases.has(msg.toLowerCase())) {
      if (/assignee is not a member/i.test(msg)) {
        return "The selected assignee is not a member of this project. Please select a valid project member or add them to the project first.";
      }
      if (/cannot delete an active project/i.test(msg)) {
        return "Cannot delete an active project. Please archive or change its status before deleting.";
      }
      return msg;
    }
  }

  // 3. Fallback to top-level errData.error if it's a string
  if (typeof errData?.error === "string" && errData.error.trim() !== "") {
    return errData.error.trim();
  }

  return defaultMsg;
}

