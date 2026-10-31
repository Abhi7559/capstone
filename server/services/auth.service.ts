import bcrypt from "bcryptjs";
import type { LoginCredentials } from "@/schemas/auth.schema";
import type { User } from "@/types/auth";
import { userRepository } from "../repositories/user.repository";

export const authServiceServer = {
  async login(credentials: LoginCredentials): Promise<User> {
    const normalizedEmail = (credentials.email || "").trim().toLowerCase();
    const userMatch = userRepository.findByEmail(normalizedEmail);

    if (!userMatch) {
      throw new Error("Invalid email or password");
    }

    const userPassword = userMatch.password || "";
    let isValid = false;

    if (userPassword.startsWith("$2a$") || userPassword.startsWith("$2b$")) {
      isValid = await bcrypt.compare(credentials.password, userPassword);
    } else {
      isValid = credentials.password === userPassword;
    }

    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    const { password: _, ...safeUser } = userMatch;
    return safeUser;
  },
};
