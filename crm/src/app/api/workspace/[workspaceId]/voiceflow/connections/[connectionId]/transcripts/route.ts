import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";
import { normalizeAndPageTranscripts, parseTranscriptFilters } from "@/server/voiceflow/transcripts";

function devDebug(sent: unknown, filters: unknown): Record<string, unknown> {
  if (process.env.NODE_ENV !== "production") {
    return { sent, filters };
  }
  return {};
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; connectionId: string }> }
) {
  const userId = await getCurrentUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { workspaceId, connectionId } = await params;

  if (!workspaceId) {
    return NextResponse.json({ error: "MISSING_WORKSPACE_ID" }, { status: 400 });
  }

  if (!connectionId) {
    return NextResponse.json({ error: "MISSING_CONNECTION_ID" }, { status: 400 });
  }

  try {
    const parsedFilters = parseTranscriptFilters(new URL(req.url));
    if (!parsedFilters.filters) {
      return NextResponse.json(
        {
          error: parsedFilters.error ?? "INVALID_QUERY",
          ...devDebug(null, null),
        },
        { status: 400 }
      );
    }

    await requireWorkspaceMember({ userId, workspaceId });

    const connection = await prisma.voiceflowConnection.findFirst({
      where: {
        id: connectionId,
        workspaceId,
        isActive: true,
      },
      select: {
        projectId: true,
        apiKeyCiphertext: true,
      },
    });

    if (!connection) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const projectId = connection.projectId;
    const apiKey = connection.apiKeyCiphertext;

    if (!apiKey) {
      return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 400 });
    }

    const sent = {
      projectId,
      body: {},
    };

    const resp = await fetch(
      `https://analytics-api.voiceflow.com/v1/transcript/project/${encodeURIComponent(
        projectId
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      }
    );

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const status = resp.status >= 400 && resp.status < 500 ? resp.status : 502;

      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          status: resp.status,
          data,
          ...devDebug(sent, parsedFilters.filters),
        },
        { status }
      );
    }

    const page = normalizeAndPageTranscripts(data, parsedFilters.filters);

    return NextResponse.json(
      {
        data: {
          items: page.items,
          pageInfo: {
            nextCursor: page.nextCursor,
            limit: parsedFilters.filters.limit,
          },
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const status = getErrorStatus(e);

    return NextResponse.json(
      {
        error: status === 403 ? "FORBIDDEN" : "SERVER_ERROR",
      },
      { status }
    );
  }
}
