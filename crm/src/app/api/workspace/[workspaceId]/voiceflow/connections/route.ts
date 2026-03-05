import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { workspaceId } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "MISSING_WORKSPACE_ID" }, { status: 400 });
  }

  try {
    await requireWorkspaceMember({ userId, workspaceId });

    const connections = await prisma.voiceflowConnection.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        projectId: true,
        channel: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ connections });
  } catch (e: unknown) {
    const status = getErrorStatus(e);
    return NextResponse.json(
      { error: status === 403 ? "FORBIDDEN" : "SERVER_ERROR" },
      { status }
    );
  }
}
