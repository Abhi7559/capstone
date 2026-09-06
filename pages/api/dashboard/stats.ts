import type { NextApiRequest, NextApiResponse } from "next";
import { dashboardServiceServer } from "@/server/services/dashboard.service";
import type {
  AdminDashboardData,
  MemberDashboardData,
} from "@/types/dashboard";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    AdminDashboardData | MemberDashboardData | { message: string }
  >,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await new Promise((resolve) => setTimeout(resolve, 400));

  const userId = req.headers["x-user-id"] as string;
  const userRole = req.headers["x-user-role"] as string;

  try {
    const data = dashboardServiceServer.getDashboardData(userRole, userId);
    return res.status(200).json(data);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("Unauthorized") ? 401 : 400;
    return res.status(status).json({ message });
  }
}
