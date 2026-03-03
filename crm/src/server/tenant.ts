import { prisma } from "@/lib/prisma";

export async function workspaceIdFromWorkspaceKey(req: Request) {
  const key = req.headers.get("x-workspace-key");
  if (!key) return { ok: false as const, status: 401, message: "Missing x-workspace-key" };

  const ws = await prisma.workspace.findUnique({
    where: { workspaceKey: key },
    select: { id: true },
  });

  if (!ws) return { ok: false as const, status: 403, message: "Invalid workspace key" };
  return { ok: true as const, workspaceId: ws.id };
}