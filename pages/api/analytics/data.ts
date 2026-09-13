import type { NextApiRequest, NextApiResponse } from "next";
import { analyticsServiceServer } from "@/server/services/analytics.service";
import { getAuthContext } from "@/server/utils/auth";
import type { User } from "@/types/auth";
import type { Task } from "@/types/task";

export interface AnalyticsApiResponse {
  tasks: Task[];
  members: User[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyticsApiResponse | { message: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userRole, userId } = await getAuthContext(req, res);

  try {
    const data = analyticsServiceServer.getAnalyticsData(userRole, userId);
    return res.status(200).json(data);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("Unauthorized") ? 401 : 400;
    return res.status(status).json({ message });
  }
}
