import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendHost } from "@/utils/apiConfig";

/**
 * Proxy route for HTMX Dashboard Stats Fragment.
 * Forwards requests to FastAPI's /htmx/dashboard/stats and returns raw HTML.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const backendHost = getBackendHost();
    const token = req.query.token as string | undefined;
    const authHeader = req.headers.authorization;

    const url = new URL(`${backendHost}/htmx/dashboard/stats`);
    if (token) {
      url.searchParams.set("token", token);
    }

    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    if (req.headers["x-user-role"]) {
      headers["x-user-role"] = req.headers["x-user-role"] as string;
    }
    if (req.headers["x-user-id"]) {
      headers["x-user-id"] = req.headers["x-user-id"] as string;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    const html = await response.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(response.status).send(html);
  } catch (error) {
    return res
      .status(500)
      .send(
        `<div class="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">Failed to load HTMX stats fragment from server.</div>`,
      );
  }
}

