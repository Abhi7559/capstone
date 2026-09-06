import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { memberServiceServer } from "@/server/services/member.service";
import type { InviteMemberInput, InviteMemberResponse } from "@/types/auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InviteMemberResponse | { message: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const headerRole = req.headers["x-user-role"] as string;
  const userRole = session?.user?.role || headerRole || "admin";

  try {
    const input = (req.body || {}) as InviteMemberInput;
    if (!input.name || !input.email) {
      return res.status(400).json({ message: "Name and Email are required." });
    }

    const response = memberServiceServer.inviteMember(input, userRole);
    return res.status(201).json(response);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("Forbidden") ? 403 : 400;
    return res.status(status).json({ message });
  }
}

