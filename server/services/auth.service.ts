import type { LoginCredentials } from "@/schemas/auth.schema";
import type { User } from "@/types/auth";
import { userRepository } from "../repositories/user.repository";

export const authServiceServer = {
  login(credentials: LoginCredentials): User {
    const normalizedEmail = credentials.email.trim().toLowerCase();
    const userMatch = userRepository.findByEmail(normalizedEmail);

    if (!userMatch || userMatch.password !== credentials.password) {
      throw new Error("Invalid email or password");
    }

    const { password: _, ...safeUser } = userMatch;
    return safeUser;
  },
};
