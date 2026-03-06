import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";

function devDebug(
  sent: unknown,
  endpoint: string | string[]
): { sent?: unknown; endpoint?: string | string[] } {
  if (process.env.NODE_ENV !== "production") {
    return { sent, endpoint };
  }
  return {};
}

type RouteParams = {
  workspaceId: string;
  connectionId: string;
  transcriptId: string;
};

export async function GET(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  const userId = await getCurrentUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { workspaceId, connectionId, transcriptId } = await params;

  if (!workspaceId) {
    return NextResponse.json({ error: "MISSING_WORKSPACE_ID" }, { status: 400 });
  }

  if (!connectionId) {
    return NextResponse.json({ error: "MISSING_CONNECTION_ID" }, { status: 400 });
  }

  if (!transcriptId) {
    return NextResponse.json({ error: "MISSING_TRANSCRIPT_ID" }, { status: 400 });
  }

  try {
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

    const primaryEndpoint = `https://analytics-api.voiceflow.com/v1/transcript/${encodeURIComponent(
      transcriptId
    )}`;
    const fallbackEndpoint = `https://api.voiceflow.com/v2/transcripts/${encodeURIComponent(
      projectId
    )}/${encodeURIComponent(transcriptId)}`;

    const sent = {
      transcriptId,
      projectId,
    };

    const headers = {
      Authorization: apiKey,
      accept: "application/json",
      "content-type": "application/json",
    };

    let resp: Response;
    let data: unknown;

    try {
      resp = await fetch(primaryEndpoint, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      data = await resp.json().catch(() => null);
    } catch {
      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          status: 502,
          data: null,
          ...devDebug(sent, primaryEndpoint),
        },
        { status: 502 }
      );
    }

    // Optional fallback to deprecated endpoint when transcript isn't found on analytics.
    if (resp.status === 404) {
      try {
        const fallbackResp = await fetch(fallbackEndpoint, {
          method: "GET",
          headers,
          cache: "no-store",
        });
        const fallbackData = await fallbackResp.json().catch(() => null);

        if (fallbackResp.ok) {
          return NextResponse.json(
            {
              data: {
                transcriptId,
                transcript: fallbackData,
              },
            },
            { status: 200 }
          );
        }

        const fallbackStatus =
          fallbackResp.status >= 400 && fallbackResp.status < 500 ? fallbackResp.status : 502;

        return NextResponse.json(
          {
            error: "VOICEFLOW_ERROR",
            status: fallbackResp.status,
            data: fallbackData,
            ...devDebug(sent, [primaryEndpoint, fallbackEndpoint]),
          },
          { status: fallbackStatus }
        );
      } catch {
        return NextResponse.json(
          {
            error: "VOICEFLOW_ERROR",
            status: 502,
            data: null,
            ...devDebug(sent, [primaryEndpoint, fallbackEndpoint]),
          },
          { status: 502 }
        );
      }
    }

    if (!resp.ok) {
      const status = resp.status >= 400 && resp.status < 500 ? resp.status : 502;
      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          status: resp.status,
          data,
          ...devDebug(sent, primaryEndpoint),
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: {
          transcriptId,
          transcript: data,
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
