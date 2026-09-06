import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { memberServiceServer } from "@/server/services/member.service";
import type { User } from "@/types/auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User[] | { message: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const headerRole = req.headers["x-user-role"] as string;
  const userRole = session?.user?.role || headerRole || "admin";

  try {
    const members = memberServiceServer.getMembers(userRole);
    return res.status(200).json(members);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("Forbidden") ? 403 : 400;
    return res.status(status).json({ message });
  }
}

