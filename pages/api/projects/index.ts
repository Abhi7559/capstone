import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { projectServiceServer } from "@/server/services/project.service";
import type { CreateProjectInput, Project } from "@/types/project";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project[] | Project | { message: string }>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userRole = (session?.user?.role ||
    req.headers["x-user-role"]) as string;
  const userId = (session?.user?.id || req.headers["x-user-id"]) as string;

  if (req.method === "GET") {
    if (!session && !req.headers["x-user-id"]) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const projects = projectServiceServer.getProjects(userRole, userId);
      return res.status(200).json(projects);
    } catch (error) {
      return res.status(401).json({ message: (error as Error).message });
    }
  }

  if (req.method === "POST") {
    if (!session && !req.headers["x-user-id"]) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only admins can create projects." });
    }

    try {
      const input = (req.body || {}) as CreateProjectInput;
      if (!input.name || !input.description) {
        return res
          .status(400)
          .json({ message: "Project name and description are required." });
      }

      const newProject = projectServiceServer.createProject(
        input,
        userRole,
        userId,
      );
      return res.status(201).json(newProject);
    } catch (error) {
      const message = (error as Error).message;
      const status = message.includes("Forbidden") ? 403 : 400;
      return res.status(status).json({ message });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
