import { NextRequest } from "next/server";

export function getCurrentUserId(req: NextRequest): string | null {
  // Option A: pass from client as a header while you develop
  const headerId = req.headers.get("x-user-id");
  if (headerId) return headerId;

  // Option B: fallback to .env
  return process.env.DEMO_USER_ID ?? null;
}