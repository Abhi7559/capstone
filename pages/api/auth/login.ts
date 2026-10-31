import type { NextApiRequest, NextApiResponse } from "next";
import type { LoginCredentials } from "@/schemas/auth.schema";
import { userRepository } from "@/server/repositories/user.repository";
import { authServiceServer } from "@/server/services/auth.service";
import type { User } from "@/types/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User | { message: string }>,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const credentials = (req.body || {}) as LoginCredentials;
    const normalizedEmail = (credentials.email || "").trim().toLowerCase();

    // 1. Try FastAPI backend if running
    try {
      const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8000";
      const backendRes = await fetch(
        `${backendUrl}/task_management/api/v1/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password: credentials.password,
          }),
        },
      );

      if (backendRes.ok) {
        const data = await backendRes.json();
        let user = data.user;

        // If backend returns { accessToken, refreshToken, ... } without a user object, fetch /auth/me
        if (!user && data.accessToken) {
          try {
            const meRes = await fetch(
              `${backendUrl}/task_management/api/v1/auth/me`,
              {
                headers: { Authorization: `Bearer ${data.accessToken}` },
              },
            );
            if (meRes.ok) {
              user = await meRes.json();
            }
          } catch {
            // fallback
          }
        }

        // Fallback user object if not populated
        if (!user) {
          const localMatch = userRepository.findByEmail(normalizedEmail);
          user = {
            id: localMatch?.id || crypto.randomUUID(),
            email: normalizedEmail,
            name: localMatch?.name || normalizedEmail.split("@")[0],
            role: localMatch?.role || "member",
            requiresPasswordChange: false,
          };
        }

        // Sync password and updated status to local repository so NextAuth and mock services stay aligned
        const localUser = userRepository.findByEmail(normalizedEmail);
        if (localUser) {
          userRepository.update(localUser.id, {
            password: credentials.password,
            requiresPasswordChange: user.requiresPasswordChange ?? false,
          });
        } else {
          userRepository.create({
            id: user.id || crypto.randomUUID(),
            email: normalizedEmail,
            name: user.name || normalizedEmail.split("@")[0],
            role: user.role || "member",
            password: credentials.password,
            status: user.status || "active",
            designation: user.designation,
            joiningDate: user.joiningDate,
            requiresPasswordChange: user.requiresPasswordChange ?? false,
          });
        }

        const userWithTokens = {
          ...user,
          token: data.accessToken || undefined,
          refreshToken: data.refreshToken || undefined,
        };

        return res.status(200).json(userWithTokens);
      } else if (backendRes.status === 401 || backendRes.status === 403) {
        const errData = await backendRes.json().catch(() => ({}));
        // If FastAPI explicitly rejected the password, throw the message
        throw new Error(
          errData.detail || errData.message || "Invalid email or password",
        );
      }
    } catch (backendError) {
      // If FastAPI specifically gave an invalid password / credentials error, propagate it
      const msg = (backendError as Error).message || "";
      if (
        msg.includes("Invalid email or password") ||
        msg.includes("credentials")
      ) {
        return res.status(400).json({ message: msg });
      }
      // Otherwise fallback to local mock store
    }

    // 2. Local mock repository fallback
    const user = await authServiceServer.login(credentials);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
