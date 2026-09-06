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

  try {
    const { email, currentPassword, newPassword } = (req.body || {}) as ChangePasswordValues;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let userMatch = userRepository.findByEmail(normalizedEmail);

    if (!userMatch) {
      // Create user record in repository if missing from server memory
      const newUser: User = {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
        role: "member",
        requiresPasswordChange: false,
      };
      userRepository.create({ ...newUser, password: newPassword });
      return res.status(200).json(newUser);
    }

    if (userMatch.password && userMatch.password !== currentPassword) {
      return res.status(400).json({ message: "Current temporary password is incorrect" });
    }

    // Update password and clear requiresPasswordChange flag
    const updated = userRepository.update(userMatch.id, {
      password: newPassword,
      requiresPasswordChange: false,
    });

    const safeUser: User = updated
      ? (({ password: _, ...u }) => u as User)(updated)
      : {
          id: userMatch.id,
          email: userMatch.email,
          name: userMatch.name,
          role: userMatch.role,
          requiresPasswordChange: false,
        };

    return res.status(200).json(safeUser);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
