import type { NextConfig } from "next";

const DEFAULT_PRODUCTION_BACKEND = "https://teamhub-backend-p5a1.onrender.com";

function cleanBackendUrl(raw?: string): string {
  if (!raw) return "";
  let url = raw.trim();
  const secondHttp = url.indexOf("http", 4);
  if (secondHttp !== -1) {
    url = url.substring(0, secondHttp);
  }
  if (url.includes("capstone-fr3d.onrender.com")) {
    url = DEFAULT_PRODUCTION_BACKEND;
  }
  return url.replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.VERCEL ? undefined : "standalone",
  async rewrites() {
    let raw = cleanBackendUrl(
      process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_API_URL,
    );
    if (raw.includes("localhost:8000")) {
      raw = "";
    }
    let backendUrl = raw || DEFAULT_PRODUCTION_BACKEND;

    if (
      !backendUrl.startsWith("http://") &&
      !backendUrl.startsWith("https://")
    ) {
      backendUrl = `https://${backendUrl}`;
    }
    backendUrl = backendUrl.replace(/\/+$/, "");

    return [
      {
        source: "/api/projects/:path*",
        destination: `${backendUrl}/task_management/api/v1/projects/:path*`,
      },
      {
        source: "/api/tasks/:path*",
        destination: `${backendUrl}/task_management/api/v1/tasks/:path*`,
      },
      {
        source: "/api/members/:path*",
        destination: `${backendUrl}/task_management/api/v1/members/:path*`,
      },
      {
        source: "/api/analytics/:path*",
        destination: `${backendUrl}/task_management/api/v1/analytics/:path*`,
      },
      {
        source: "/api/dashboard/:path*",
        destination: `${backendUrl}/task_management/api/v1/dashboard/:path*`,
      },
      {
        source: "/api/health",
        destination: `${backendUrl}/task_management/api/v1/health`,
      },
    ];
  },
};

export default nextConfig;
