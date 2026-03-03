import { prisma } from "@/lib/prisma";
import { workspaceIdFromWorkspaceKey } from "@/server/tenant";

export async function GET(req: Request) {
  const tenant = await workspaceIdFromWorkspaceKey(req);
  if (!tenant.ok) return Response.json({ error: tenant.message }, { status: tenant.status });

  const workspace = await prisma.workspace.findUnique({
    where: { id: tenant.workspaceId },
    select: { id: true, name: true, workspaceKey: true, webhookKey: true, createdAt: true },
  });

  return Response.json({ workspace });
}