import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { db } from "@/server/database/db";
import { projectRepository } from "@/server/repositories/project.repository";
import type { ProjectActivity } from "@/types/project";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProjectActivity[] | { message: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id || (req.headers["x-user-id"] as string);
  const userRole =
    session?.user?.role || (req.headers["x-user-role"] as string);

  const { id } = req.query as { id: string };

  if (!id) {
    return res.status(400).json({ message: "Project ID is required" });
  }

  const project = projectRepository.findById(id);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  const isAdmin = !userRole || userRole.toLowerCase() === "admin";
  const isMember = Boolean(userId) && project.memberIds.includes(userId);

  if (!isAdmin && !isMember) {
    return res
      .status(403)
      .json({ message: "Forbidden: You do not have access to this project" });
  }

  const activities = db.getProjectActivities(id);
  return res.status(200).json(activities);
}
