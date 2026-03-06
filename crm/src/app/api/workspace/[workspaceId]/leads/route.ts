import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";

function parseLimit(value: string | null): number | null {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, 200);
}

function parseOffset(value: string | null): number | null {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { workspaceId } = await params;
  if (!workspaceId) {
    return NextResponse.json({ error: "MISSING_WORKSPACE_ID" }, { status: 400 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));

  if (limit === null) {
    return NextResponse.json({ error: "INVALID_LIMIT" }, { status: 400 });
  }

  if (offset === null) {
    return NextResponse.json({ error: "INVALID_OFFSET" }, { status: 400 });
  }

  try {
    await requireWorkspaceMember({ userId, workspaceId });

    const where: Prisma.LeadWhereInput = {
      workspaceId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { message: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ lastCapturedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          message: true,
          source: true,
          lastCapturedAt: true,
          createdAt: true,
          connectionId: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json(
      {
        data: {
          items,
          total,
          limit,
          offset,
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const status = getErrorStatus(e);
    return NextResponse.json(
      { error: status === 403 ? "FORBIDDEN" : "SERVER_ERROR" },
      { status }
    );
  }
}
