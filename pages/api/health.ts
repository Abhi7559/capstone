import type { NextApiRequest, NextApiResponse } from "next";

export type HealthResponse = {
  name: string;
  version: string;
  status: string;
  timestamp: string;
  uptime: number;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { message: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  return res.status(200).json({
    name: "capstone-project",
    version: "0.1.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
