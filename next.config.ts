import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: process.env.VERCEL ? undefined : "standalone",
  async rewrites() {
    let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
    if (!backendUrl) return [];
    if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
      backendUrl = `https://${backendUrl}`;
    }
    backendUrl = backendUrl.replace(/\/+$/, "");
    return [
      {
        source: "/api/projects/:path*",
        destination: `${backendUrl}/api/projects/:path*`,
      },
      {
        source: "/api/tasks/:path*",
        destination: `${backendUrl}/api/tasks/:path*`,
      },
      {
        source: "/api/members/:path*",
        destination: `${backendUrl}/api/members/:path*`,
      },
      {
        source: "/api/analytics/:path*",
        destination: `${backendUrl}/api/analytics/:path*`,
      },
      {
        source: "/api/dashboard/:path*",
        destination: `${backendUrl}/api/dashboard/:path*`,
      },
      {
        source: "/api/health",
        destination: `${backendUrl}/api/health`,
      },
    ];
  },
};

export default nextConfig;
