import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/server/database/db";

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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
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
