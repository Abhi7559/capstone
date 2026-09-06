import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { projectServiceServer } from "@/server/services/project.service";
import type { Project, UpdateProjectInput } from "@/types/project";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project | { message: string }>,
) {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const session = await getServerSession(req, res, authOptions);
  const userRole = (session?.user?.role ||
    req.headers["x-user-role"]) as string;
  const { id } = req.query as { id: string };

  if (!session && !req.headers["x-user-id"] && !req.headers["x-user-role"]) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!id) {
    return res.status(400).json({ message: "Project ID is required" });
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    try {
      const input = (req.body || {}) as UpdateProjectInput;
      const updated = projectServiceServer.updateProject(id, input, userRole);
      return res.status(200).json(updated);
    } catch (error) {
      const message = (error as Error).message;
      const status = message.includes("Forbidden")
        ? 403
        : message.includes("not found")
          ? 404
          : 400;
      return res.status(status).json({ message });
    }
  }

  if (req.method === "DELETE") {
    try {
      projectServiceServer.deleteProject(id, userRole);
      return res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
      const message = (error as Error).message;
      const status = message.includes("Forbidden")
        ? 403
        : message.includes("not found")
          ? 404
          : 400;
      return res.status(status).json({ message });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
