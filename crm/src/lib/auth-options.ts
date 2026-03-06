import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { AUTH_SECRET } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getUserWorkspace } from "@/lib/userWorkspace";

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Username and Password",
      credentials: {
        username: {
          label: "Username",
          type: "text",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const username =
          typeof credentials?.username === "string" ? credentials.username.trim() : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!username || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true,
            username: true,
            password: true,
            name: true,
            email: true,
            image: true,
          },
        });

        if (!user || !user.username) {
          return null;
        }

        const validPassword = await verifyPassword({
          candidatePassword: password,
          storedPassword: user.password,
        });

        if (!validPassword) {
          return null;
        }

        const workspace = await getUserWorkspace(user.id);
        if (!workspace) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          username: user.username,
          workspaceId: workspace.workspaceId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.workspaceId = user.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) {
        return session;
      }

      session.user.id = token.sub;
      session.user.username = typeof token.username === "string" ? token.username : null;
      session.user.workspaceId =
        typeof token.workspaceId === "string" ? token.workspaceId : null;

      return session;
    },
  },
};
