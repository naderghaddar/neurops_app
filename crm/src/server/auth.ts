import { cookies } from "next/headers";

/**
 * Replace this with your real auth.
 * For now it reads a cookie like "userId".
 */
export async function requireAuthUserId(): Promise<string> {
  const c = await cookies();
  const userId = c.get("userId")?.value;

  if (!userId) {
    // NextResponse.json is in route file; here just throw
    throw new Error("UNAUTHORIZED");
  }

  return userId;
}