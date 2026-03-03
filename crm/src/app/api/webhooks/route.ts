import { prisma } from "@/lib/prisma";
import { workspaceIdFromWorkspaceKey } from "@/server/tenant";

export async function POST(req: Request) {
  const tenant = await workspaceIdFromWorkspaceKey(req);
  if (!tenant.ok) {
    return Response.json({ error: tenant.message }, { status: tenant.status });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  // Minimal required fields
  const type = typeof payload?.type === "string" ? payload.type : "webhook.event";
  const occurredAtRaw = payload?.occurredAt;
  const occurredAt =
    typeof occurredAtRaw === "string" || typeof occurredAtRaw === "number"
      ? new Date(occurredAtRaw)
      : new Date();

  const externalEventId =
    typeof payload?.externalEventId === "string" ? payload.externalEventId : null;
  const source = typeof payload?.source === "string" ? payload.source : "webhook";

  // Simple de-dupe if externalEventId is provided
  if (externalEventId) {
    const existing = await prisma.event.findFirst({
      where: { workspaceId: tenant.workspaceId, externalEventId },
      select: { id: true },
    });
    if (existing) return Response.json({ ok: true, deduped: true });
  }

  const event = await prisma.event.create({
    data: {
      workspaceId: tenant.workspaceId,
      type,
      source,
      occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      externalEventId,
      payload,
    },
    select: { id: true, receivedAt: true },
  });

  return Response.json({ ok: true, event }, { status: 201 });
}