import type { NextApiRequest, NextApiResponse } from "next";
import type { LoginCredentials } from "@/schemas/auth.schema";
import { authServiceServer } from "@/server/services/auth.service";
import type { User } from "@/types/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User | { message: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 400));

  try {
    const credentials = (req.body || {}) as LoginCredentials;
    const user = authServiceServer.login(credentials);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
