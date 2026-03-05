import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";

type RouteParams = {
  workspaceId: string;
  connectionId: string;
  transcriptId: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function devPayload(base: Record<string, unknown>): Record<string, unknown> {
  if (process.env.NODE_ENV !== "production") {
    return base;
  }
  return {};
}

function getRecordingUrl(raw: unknown): string | null {
  if (!isRecord(raw)) return null;

  const rootUrl = asString(raw.recordingURL) ?? asString(raw.recordingUrl);
  if (rootUrl) return rootUrl;

  const transcript = raw.transcript;
  if (!isRecord(transcript)) return null;
  return asString(transcript.recordingURL) ?? asString(transcript.recordingUrl);
}

  export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const userId = getCurrentUserId(req);

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
        apiKeyCiphertext: true,
      },
    });

    if (!connection) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const apiKey = connection.apiKeyCiphertext;
    if (!apiKey) {
      return NextResponse.json({ error: "MISSING_API_KEY" }, { status: 400 });
    }

    const transcriptEndpoint = `https://analytics-api.voiceflow.com/v1/transcript/${encodeURIComponent(
      transcriptId
    )}`;

    let transcriptResp: Response;
    let transcriptData: unknown;
    try {
      transcriptResp = await fetch(transcriptEndpoint, {
        method: "GET",
        headers: {
          Authorization: apiKey,
          accept: "application/json",
        },
        cache: "no-store",
      });
      transcriptData = await transcriptResp.json().catch(() => null);
    } catch {
      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          ...devPayload({
            status: 502,
            endpoint: transcriptEndpoint,
          }),
        },
        { status: 502 }
      );
    }

    if (!transcriptResp.ok) {
      const status =
        transcriptResp.status >= 400 && transcriptResp.status < 500
          ? transcriptResp.status
          : 502;
      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          ...devPayload({
            status: transcriptResp.status,
            data: transcriptData,
            endpoint: transcriptEndpoint,
          }),
        },
        { status }
      );
    }

    const recordingUrl = getRecordingUrl(transcriptData);
    if (!recordingUrl) {
      return NextResponse.json({ error: "NO_RECORDING" }, { status: 404 });
    }

    const rangeHeader = req.headers.get("range");
    const audioHeaders = new Headers();
    if (rangeHeader) {
      audioHeaders.set("Range", rangeHeader);
    }

    const audioResp = await fetch(recordingUrl, {
      method: "GET",
      headers: audioHeaders,
      cache: "no-store",
    });

    if (!audioResp.ok) {
      let upstreamBody: string | null = null;
      if (process.env.NODE_ENV !== "production") {
        upstreamBody = await audioResp.text().catch(() => null);
      }
      return NextResponse.json(
        {
          error: "RECORDING_UPSTREAM_ERROR",
          ...devPayload({
            upstreamStatus: audioResp.status,
            recordingUrl,
            body: upstreamBody,
          }),
        },
        { status: 502 }
      );
    }

    const passthroughHeaders = new Headers();
    passthroughHeaders.set(
      "Content-Type",
      audioResp.headers.get("content-type") ?? "audio/wav"
    );
    passthroughHeaders.set("Accept-Ranges", "bytes");
    passthroughHeaders.set("Cache-Control", "private, max-age=0, no-store");

    const contentLength = audioResp.headers.get("content-length");
    if (contentLength) {
      passthroughHeaders.set("Content-Length", contentLength);
    }

    const contentRange = audioResp.headers.get("content-range");
    if (contentRange) {
      passthroughHeaders.set("Content-Range", contentRange);
    }

    return new NextResponse(audioResp.body, {
      status: audioResp.status,
      headers: passthroughHeaders,
    });
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
