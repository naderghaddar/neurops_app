import { prisma } from "@/lib/prisma";
import { workspaceIdFromWorkspaceKey } from "@/server/tenant";

export async function GET(req: Request) {
  const tenant = await workspaceIdFromWorkspaceKey(req);
  if (!tenant.ok) {
    return Response.json({ error: tenant.message }, { status: tenant.status });
  }

  const events = await prisma.event.findMany({
    where: { workspaceId: tenant.workspaceId },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      source: true,
      occurredAt: true,
      receivedAt: true,
      externalEventId: true,
    },
  });

  return Response.json({ events });
}