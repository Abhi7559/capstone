import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { taskServiceServer } from "@/server/services/task.service";
import type { Task, UpdateTaskInput } from "@/types/task";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Task | { message: string }>,
) {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id || (req.headers["x-user-id"] as string);
  const userRole =
    session?.user?.role || (req.headers["x-user-role"] as string);

  const { id } = req.query as { id: string };

  if (!id) {
    return res.status(400).json({ message: "Task ID is required" });
  }

  if (req.method === "GET") {
    try {
      const task = taskServiceServer.getTaskById(id, userRole, userId);
      return res.status(200).json(task);
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

  if (req.method === "PATCH" || req.method === "PUT") {
    try {
      const input = (req.body || {}) as UpdateTaskInput;
      const updated = taskServiceServer.updateTask(id, input, userRole, userId);
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
      taskServiceServer.deleteTask(id, userRole, userId);
      return res
        .status(200)
        .json({ message: "Task deleted successfully" });
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
