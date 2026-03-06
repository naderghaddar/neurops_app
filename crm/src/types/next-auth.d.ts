import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string | null;
      workspaceId: string | null;
    };
  }

  interface User extends DefaultUser {
    username: string;
    workspaceId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    workspaceId?: string;
  }
}
