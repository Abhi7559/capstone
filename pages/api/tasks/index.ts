import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { taskServiceServer } from "@/server/services/task.service";
import type { CreateTaskInput, Task, TaskFilters } from "@/types/task";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Task[] | Task | { message: string }>,
) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id || (req.headers["x-user-id"] as string);
  const userRole =
    session?.user?.role || (req.headers["x-user-role"] as string);

  if (!userId || !userRole) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { projectId, status, priority, assigneeId, dueDate } = req.query as {
      projectId?: string;
    } & TaskFilters;

    try {
      if (projectId && projectId !== "all") {
        const tasks = taskServiceServer.getProjectTasks(
          projectId,
          { status, priority, assigneeId, dueDate },
          userRole,
          userId,
        );
        return res.status(200).json(tasks);
      }

      const tasks = taskServiceServer.getAllTasks(userRole, userId);
      return res.status(200).json(tasks);
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

  if (req.method === "POST") {
    try {
      const input = (req.body || {}) as CreateTaskInput;
      if (
        !input.projectId ||
        !input.title ||
        !input.description ||
        !input.priority ||
        !input.assigneeId ||
        !input.dueDate
      ) {
        return res
          .status(400)
          .json({ message: "All required task fields must be provided." });
      }

      const newTask = taskServiceServer.createTask(input, userRole);
      return res.status(201).json(newTask);
    } catch (error) {
      const message = (error as Error).message;
      const status = message.includes("Forbidden") ? 403 : 400;
      return res.status(status).json({ message });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
