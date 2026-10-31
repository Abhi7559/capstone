import type { NextApiRequest, NextApiResponse } from "next";
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
    const { email, newPassword, confirmPassword, token } = req.body || {};

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email and new password are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try FastAPI backend if running
    try {
      const backendUrl =
        process.env.BACKEND_API_URL ||
        (process.env.NODE_ENV === "production"
          ? "http://backend:8000"
          : "http://localhost:8000");
      const backendRes = await fetch(
        `${backendUrl}/task_management/api/v1/auth/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            newPassword,
            confirmPassword,
            token: token || null,
          }),
        },
      );

      if (backendRes.ok) {
        const data = await backendRes.json();
        // Keep local user repository synchronized with the newly set password
        const localUser = userRepository.findByEmail(normalizedEmail);
        if (localUser) {
          userRepository.update(localUser.id, {
            password: newPassword,
            requiresPasswordChange: false,
          });
        } else {
          userRepository.create({
            id: data.user?.id || crypto.randomUUID(),
            email: normalizedEmail,
            name: data.user?.name || normalizedEmail.split("@")[0],
            role: (data.user?.role as "admin" | "member") || "member",
            password: newPassword,
            requiresPasswordChange: false,
          });
        }
        return res.status(200).json(data.user);
      }
    } catch {
      // Fallback to local user repository
    }

    // 2. Local User Repository fallback
    const userMatch = userRepository.findByEmail(normalizedEmail);
    if (!userMatch) {
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
