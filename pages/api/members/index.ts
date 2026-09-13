import type { NextApiRequest, NextApiResponse } from "next";
import { memberServiceServer } from "@/server/services/member.service";
import { getAuthContext } from "@/server/utils/auth";
import type { User } from "@/types/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User[] | { message: string }>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userRole } = await getAuthContext(req, res);

  try {
    const members = memberServiceServer.getMembers(userRole);
    return res.status(200).json(members);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("Forbidden") ? 403 : 400;
    return res.status(status).json({ message });
  }
}
