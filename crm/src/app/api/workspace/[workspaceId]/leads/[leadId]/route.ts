import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; leadId: string }> }
) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { workspaceId, leadId } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "MISSING_WORKSPACE_ID" }, { status: 400 });
  }
  if (!leadId) {
    return NextResponse.json({ error: "MISSING_LEAD_ID" }, { status: 400 });
  }

  try {
    await requireWorkspaceMember({ userId, workspaceId });

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId },
      select: {
        id: true,
        workspaceId: true,
        connectionId: true,
        name: true,
        phone: true,
        email: true,
        message: true,
        source: true,
        lastCapturedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "LEAD_NOT_FOUND" }, { status: 404 });
    }

    const events = await prisma.leadEvent.findMany({
      where: { workspaceId, leadId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        connectionId: true,
        type: true,
        occurredAt: true,
        createdAt: true,
        payload: true,
      },
    });

    return NextResponse.json({ data: { lead, events } }, { status: 200 });
  } catch (e: unknown) {
    const status = getErrorStatus(e);
    return NextResponse.json(
      { error: status === 403 ? "FORBIDDEN" : "SERVER_ERROR" },
      { status }
    );
  }
}
