import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspaceAccess";
import { getErrorStatus } from "@/lib/errors";
import {
  extractChatMessagesFromLogs,
  extractStrictChatMessagesFromLogs,
  type ChatMessage,
} from "@/server/voiceflow/transcriptMessages";

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

function devDebug(
  endpoint: string,
  sent: unknown
): { endpoint?: string; sent?: unknown } {
  if (process.env.NODE_ENV !== "production") {
    return { endpoint, sent };
  }
  return {};
}

function getTranscriptProperties(raw: unknown): Array<{ name: string; value: unknown }> {
  if (!isRecord(raw)) return [];
  if (!isRecord(raw.transcript)) return [];
  const properties = raw.transcript.properties;
  if (!Array.isArray(properties)) return [];

  const parsed: Array<{ name: string; value: unknown }> = [];
  for (const entry of properties) {
    if (!isRecord(entry)) continue;
    if (typeof entry.name !== "string") continue;
    parsed.push({ name: entry.name, value: entry.value });
  }
  return parsed;
}

function getModality(raw: unknown): string | null {
  const props = getTranscriptProperties(raw);
  const modality = props.find((p) => p.name === "modality");
  return modality ? asString(modality.value) : null;
}

function getRecordingUrl(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  if (!isRecord(raw.transcript)) return null;
  return asString(raw.transcript.recordingURL) ?? asString(raw.transcript.recordingUrl);
}

function arraysFromRecord(record: UnknownRecord): unknown[][] {
  const arrays: unknown[][] = [];

  if (Array.isArray(record.logs)) arrays.push(record.logs);
  if (Array.isArray(record.turns)) arrays.push(record.turns);
  if (Array.isArray(record.messages)) arrays.push(record.messages);
  if (Array.isArray(record.events)) arrays.push(record.events);
  if (Array.isArray(record.conversation)) arrays.push(record.conversation);
  if (Array.isArray(record.dialogue)) arrays.push(record.dialogue);
  if (Array.isArray(record.utterances)) arrays.push(record.utterances);
  if (Array.isArray(record.segments)) arrays.push(record.segments);
  if (Array.isArray(record.entries)) arrays.push(record.entries);
  if (Array.isArray(record.transcript)) arrays.push(record.transcript);

  if (isRecord(record.logs)) {
    if (Array.isArray(record.logs.items)) arrays.push(record.logs.items);
    if (Array.isArray(record.logs.docs)) arrays.push(record.logs.docs);
    if (Array.isArray(record.logs.logs)) arrays.push(record.logs.logs);
  }

  return arrays;
}

function getLogCandidates(raw: unknown): unknown[][] {
  if (!isRecord(raw)) return [];

  const candidates: unknown[][] = [];
  candidates.push(...arraysFromRecord(raw));

  if (isRecord(raw.transcript)) {
    candidates.push(...arraysFromRecord(raw.transcript));
  }

  if (isRecord(raw.data)) {
    candidates.push(...arraysFromRecord(raw.data));
  }

  // Keep non-empty arrays only.
  return candidates.filter((c) => c.length > 0);
}

function getPrimaryChatLogs(raw: unknown): unknown[] {
  if (!isRecord(raw)) return [];

  if (Array.isArray(raw.logs)) return raw.logs;
  if (isRecord(raw.logs)) {
    if (Array.isArray(raw.logs.items)) return raw.logs.items;
    if (Array.isArray(raw.logs.docs)) return raw.logs.docs;
    if (Array.isArray(raw.logs.logs)) return raw.logs.logs;
  }

  if (isRecord(raw.transcript)) {
    if (Array.isArray(raw.transcript.logs)) return raw.transcript.logs;
    if (isRecord(raw.transcript.logs)) {
      if (Array.isArray(raw.transcript.logs.items)) return raw.transcript.logs.items;
      if (Array.isArray(raw.transcript.logs.docs)) return raw.transcript.logs.docs;
      if (Array.isArray(raw.transcript.logs.logs)) return raw.transcript.logs.logs;
    }
  }

  if (isRecord(raw.data)) {
    if (Array.isArray(raw.data.logs)) return raw.data.logs;
    if (isRecord(raw.data.logs)) {
      if (Array.isArray(raw.data.logs.items)) return raw.data.logs.items;
      if (Array.isArray(raw.data.logs.docs)) return raw.data.logs.docs;
      if (Array.isArray(raw.data.logs.logs)) return raw.data.logs.logs;
    }
  }

  return [];
}

function mergeMessagesFromCandidates(candidates: unknown[][]): ChatMessage[] {
  const merged: ChatMessage[] = [];

  for (const candidate of candidates) {
    const extracted = extractChatMessagesFromLogs(candidate);
    if (extracted.length === 0) continue;
    merged.push(...extracted);
  }

  if (merged.length === 0) return merged;

  const withIndex = merged.map((message, index) => ({ message, index }));
  withIndex.sort((a, b) => {
    const left = Date.parse(a.message.at);
    const right = Date.parse(b.message.at);

    const leftValid = Number.isFinite(left);
    const rightValid = Number.isFinite(right);

    if (leftValid && rightValid && left !== right) return left - right;
    if (leftValid !== rightValid) return leftValid ? -1 : 1;
    return a.index - b.index;
  });

  const deduped: ChatMessage[] = [];
  for (const item of withIndex) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.role === item.message.role &&
      prev.text === item.message.text &&
      prev.at === item.message.at
    ) {
      continue;
    }
    deduped.push(item.message);
  }

  return deduped;
}

const INTERNAL_ASSISTANT_EXACT = new Set([
  "starting conversation",
  "resources consumption",
  "starting execution",
  "successfully executed",
  "undefined first chunk received",
  "ai result",
  "succeeded",
  "saving location/resolving stack",
]);

function isInternalAssistantMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  if (INTERNAL_ASSISTANT_EXACT.has(normalized)) return true;
  if (/^\d+\s+variable changed$/.test(normalized)) return true;
  if (
    normalized.startsWith("navigating to ") &&
    normalized.includes("condition matched")
  ) {
    return true;
  }
  return false;
}

function sanitizeConversation(messages: ChatMessage[]): ChatMessage[] {
  const filtered = messages.filter((message) => {
    if (message.role !== "assistant") return true;
    return !isInternalAssistantMessage(message.text);
  });

  // Re-dedupe after removing internal events to avoid accidental repeats.
  const deduped: ChatMessage[] = [];
  for (const message of filtered) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === message.role && prev.text === message.text) {
      continue;
    }
    deduped.push(message);
  }

  return deduped;
}

function buildDebugCandidates(candidates: unknown[][]): unknown[] {
  return candidates.map((candidate, index) => {
    const extracted = extractChatMessagesFromLogs(candidate);
    const userCount = extracted.filter((m) => m.role === "user").length;
    const assistantCount = extracted.filter((m) => m.role === "assistant").length;

    let firstType: string | null = null;
    const first = candidate[0];
    if (isRecord(first) && typeof first.type === "string") {
      firstType = first.type;
    }

    return {
      index,
      size: candidate.length,
      extracted: extracted.length,
      userCount,
      assistantCount,
      firstType,
      sample: extracted.slice(0, 2),
    };
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
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
        projectId: true,
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

    const endpoint = `https://analytics-api.voiceflow.com/v1/transcript/${encodeURIComponent(
      transcriptId
    )}`;
    const sent = { transcriptId };

    let resp: Response;
    let data: unknown;

    try {
      resp = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        cache: "no-store",
      });
      data = await resp.json().catch(() => null);
    } catch {
      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          status: 502,
          data: null,
          ...devDebug(endpoint, sent),
        },
        { status: 502 }
      );
    }

    if (!resp.ok) {
      const status = resp.status >= 400 && resp.status < 500 ? resp.status : 502;
      return NextResponse.json(
        {
          error: "VOICEFLOW_ERROR",
          status: resp.status,
          data,
          ...devDebug(endpoint, sent),
        },
        { status }
      );
    }

    const modality = getModality(data);
    const logCandidates = getLogCandidates(data);
    const rawMessages =
      modality === "chat"
        ? extractStrictChatMessagesFromLogs(getPrimaryChatLogs(data))
        : mergeMessagesFromCandidates(logCandidates);
    const messages = modality === "voice" ? sanitizeConversation(rawMessages) : rawMessages;
    const recordingUrl = getRecordingUrl(data);
    const debugRequested = req.nextUrl.searchParams.get("debug") === "1";
    const includeDebug = process.env.NODE_ENV !== "production" && debugRequested;

    return NextResponse.json(
      {
        data: {
          transcriptId,
          modality,
          recordingUrl,
          messages,
        },
        ...(includeDebug
          ? {
              debug: {
                candidates: buildDebugCandidates(logCandidates),
                totalCandidates: logCandidates.length,
              },
            }
          : {}),
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
