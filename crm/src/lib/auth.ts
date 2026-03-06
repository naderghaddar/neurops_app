import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { AUTH_SECRET } from "@/lib/auth-secret";

export async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: AUTH_SECRET });
  if (!token?.sub) {
    return null;
  }

  return token.sub;
}
