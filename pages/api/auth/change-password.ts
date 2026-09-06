import type { NextApiRequest, NextApiResponse } from "next";
import type { ChangePasswordValues } from "@/schemas/auth.schema";
import { userRepository } from "@/server/repositories/user.repository";
import type { User } from "@/types/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User | { message: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await new Promise((resolve) => setTimeout(resolve, 400));

  try {
    const { email, currentPassword, newPassword } = (req.body || {}) as ChangePasswordValues;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userMatch = userRepository.findByEmail(normalizedEmail);

    if (!userMatch || userMatch.password !== currentPassword) {
      return res.status(400).json({ message: "Current temporary password is incorrect" });
    }

    // Update password and clear requiresPasswordChange flag
    const updated = userRepository.update(userMatch.id, {
      password: newPassword,
      requiresPasswordChange: false,
    });

    if (!updated) {
      return res.status(500).json({ message: "Failed to update password" });
    }

    const { password: _, ...safeUser } = updated;
    return res.status(200).json(safeUser);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
