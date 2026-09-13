import type { NextApiRequest, NextApiResponse } from "next";
import { projectServiceServer } from "@/server/services/project.service";
import { getAuthContext } from "@/server/utils/auth";
import type { CreateProjectInput, Project } from "@/types/project";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Project[] | Project | { message: string }>,
) {
  const { userRole, userId } = await getAuthContext(req, res);

  if (req.method === "GET") {
    if (!userId) {
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
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (userRole !== "admin") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only admins can create projects." });
    }

    try {
      const input = (req.body || {}) as CreateProjectInput;
      if (!input.name) {
        return res.status(400).json({ message: "Project name is required." });
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
