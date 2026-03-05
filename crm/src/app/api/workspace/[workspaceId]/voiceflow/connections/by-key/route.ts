import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const workspaceKey = req.nextUrl.searchParams.get("workspaceKey");
  if (!workspaceKey) {
    return NextResponse.json({ error: "MISSING_WORKSPACE_KEY" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { workspaceKey },
    select: {
      id: true,
      name: true,
      workspaceKey: true,
      webhookKey: true,
      createdAt: true,
      updatedAt: true,
      voiceflow: {
        where: { isActive: true },
        select: { id: true, name: true, projectId: true, channel: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!workspace) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ workspace });
}