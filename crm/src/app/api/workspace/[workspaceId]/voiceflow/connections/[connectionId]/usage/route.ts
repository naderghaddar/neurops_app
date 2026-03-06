import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";

type UsageMetricName = "interactions" | "credits" | "duration" | "unique_users";

function parseISODateParam(url: URL, key: string): string | null {
  const v = url.searchParams.get(key);
  if (!v) return null;
  // Basic ISO-ish validation: Date.parse accepts ISO; reject invalid.
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); // last 7 days
  return { from: from.toISOString(), to: to.toISOString() };
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

    // Date range from query params ?from=...&to=... otherwise last 7 days
    const url = new URL(req.url);
    const dflt = defaultRange();
    const from = parseISODateParam(url, "from") ?? dflt.from;
    const to = parseISODateParam(url, "to") ?? dflt.to;

    // Optional metrics param: ?metrics=interactions,credits,...
    const metricsParam = url.searchParams.get("metrics");
    const defaultMetrics: UsageMetricName[] = [
      "interactions",
      "credits",
      "duration",
      "unique_users",
    ];

    const metrics: UsageMetricName[] = (metricsParam
      ? metricsParam.split(",").map((s) => s.trim())
      : defaultMetrics
    ).filter((m): m is UsageMetricName =>
      m === "interactions" || m === "credits" || m === "duration" || m === "unique_users"
    );

    if (metrics.length === 0) {
      return NextResponse.json({ error: "MISSING_METRICS" }, { status: 400 });
    }

    const payload = {
      query: metrics.map((name) => ({ name })),
      from,
      to,
      resources: [{ type: "project" as const, id: projectId }],
    };

    const resp = await fetch("https://analytics-api.voiceflow.com/v2/query/usage", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      // IMPORTANT: pass through 4xx so you see the real validation issues.
      const status = resp.status >= 400 && resp.status < 500 ? resp.status : 502;

      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          status: resp.status,
          sent: payload, // keep during debugging; remove later if you want
          data,
        },
        { status }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
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
