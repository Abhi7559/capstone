import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { memberServiceServer } from "@/server/services/member.service";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  const headerRole = req.headers["x-user-role"] as string;
  const currentUserRole = session?.user?.role || headerRole || "member";
  const { id } = req.query;
  const memberId = typeof id === "string" ? id : "";

  if (currentUserRole !== "admin") {
    return res
      .status(403)
      .json({ message: "Forbidden: Admin privileges required" });
  }

  if (req.method === "PUT") {
    try {
      const updatedMember = memberServiceServer.updateMember(
        memberId,
        req.body,
        currentUserRole,
      );
      return res.status(200).json(updatedMember);
    } catch (err) {
      return res
        .status(400)
        .json({ message: (err as Error).message || "Failed to update member" });
    }
  }

  if (req.method === "DELETE") {
    try {
      memberServiceServer.deleteMember(memberId, currentUserRole);
      return res.status(200).json({ message: "Member deleted successfully" });
    } catch (err) {
      return res
        .status(400)
        .json({ message: (err as Error).message || "Failed to delete member" });
    }
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
