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
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
