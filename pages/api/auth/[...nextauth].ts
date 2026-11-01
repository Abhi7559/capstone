import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/server/database/db";
import { getBackendHost } from "@/utils/apiConfig";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        // 1. Try FastAPI backend first
        try {
          const backendUrl = getBackendHost();
          const backendRes = await fetch(
            `${backendUrl}/task_management/api/v1/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            },
          );

          if (backendRes.ok) {
            const data = await backendRes.json();
            let u = data.user;
            if (!u && data.accessToken) {
              try {
                const meRes = await fetch(
                  `${backendUrl}/task_management/api/v1/auth/me`,
                  {
                    headers: { Authorization: `Bearer ${data.accessToken}` },
                  },
                );
                if (meRes.ok) {
                  u = await meRes.json();
                }
              } catch {
                // fallback
              }
            }
            if (!u) {
              u = data;
            }
            return {
              id: u.id || credentials.email,
              name: u.name || credentials.email.split("@")[0],
              email: u.email || credentials.email,
              role: u.role || "member",
            };
          }
        } catch {
          // Fallback to local db below
        }

        const user = db.findUserByEmail(credentials.email);
        if (!user) {
          throw new Error("Invalid credentials");
        }

        const userPassword = user.password || "";
        let isValid = false;
        if (
          userPassword.startsWith("$2a$") ||
          userPassword.startsWith("$2b$")
        ) {
          isValid = await bcrypt.compare(credentials.password, userPassword);
        } else {
          isValid = credentials.password === userPassword;
        }

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as "admin" | "member";
        token.name = user.name;
        token.email = user.email;
      }
      if (token.id) {
        const dbUser = db.findUserById(token.id as string);
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = token.name;
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret:
    process.env.NEXTAUTH_SECRET || "capstone-project-nextauth-secret-key-12345",
};

export default NextAuth(authOptions);
