import type { NextApiRequest, NextApiResponse } from "next";
import { memberServiceServer } from "@/server/services/member.service";
import { getAuthContext } from "@/server/utils/auth";
import type { InviteMemberInput, InviteMemberResponse } from "@/types/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InviteMemberResponse | { message: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userRole } = await getAuthContext(req, res);

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
