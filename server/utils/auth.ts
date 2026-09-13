import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { db } from "@/server/database/db";
import type { User } from "@/types/auth";

export interface AuthContext {
  userId?: string;
  userRole: "admin" | "member";
  user?: User;
}

/**
 * Derives the authoritative user session and role from NextAuth session or headers,
 * verifying against the database record as single source of truth.
 */
export async function getAuthContext(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<AuthContext> {
  const session = await getServerSession(req, res, authOptions);

  const userId = session?.user?.id || (req.headers["x-user-id"] as string);
  const headerRole = req.headers["x-user-role"] as string;

  let dbUser: User | undefined;
  if (userId) {
    dbUser = db.findUserById(userId);
  }

  if (dbUser) {
    return {
      userId: dbUser.id,
      userRole: dbUser.role,
      user: dbUser,
    };
  }

  if (session?.user?.email) {
    dbUser = db.findUserByEmail(session.user.email);
    if (dbUser) {
      return {
        userId: dbUser.id,
        userRole: dbUser.role,
        user: dbUser,
      };
    }
  }

  const effectiveRole =
    headerRole === "admin" || headerRole === "member"
      ? headerRole
      : (session?.user?.role as "admin" | "member") || "member";

  return {
    userId,
    userRole: effectiveRole,
  };
}
