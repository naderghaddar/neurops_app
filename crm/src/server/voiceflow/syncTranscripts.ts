// src/server/voiceflow/syncTranscripts.ts
import { prisma } from "@/server/db";
import { fetchProjectTranscripts, TranscriptLike } from "@/server/voiceflow/client";
import { ConversationChannel, Prisma } from "@prisma/client";

function pickString(obj: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function pickDate(obj: Record<string, unknown>, keys: readonly string[]): Date | null {
  // Accept ISO strings OR unix milliseconds/seconds
  const s = pickString(obj, keys);
  if (s) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const n = pickNumber(obj, keys);
  if (n !== null) {
    const ms = n < 1e12 ? n * 1000 : n; // if seconds, convert to ms
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function normalizeChannel(raw: unknown): ConversationChannel | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase();
  if (v.includes("phone") || v.includes("call") || v === "voice") return "PHONE";
  if (v.includes("chat") || v.includes("web") || v.includes("dm")) return "CHAT";
  return null;
}

function getTranscriptId(t: TranscriptLike): string | null {
  // Try common id fields
  return pickString(t, ["id", "transcriptId", "transcriptID", "transcript_id", "sessionID", "sessionId"]);
}

function getOccurredAt(t: TranscriptLike): Date | null {
  return pickDate(t, ["occurredAt", "createdAt", "created_at", "timestamp", "time", "startTime"]);
}

function getChannel(t: TranscriptLike): ConversationChannel | null {
  // Try common channel fields
  const channelStr = pickString(t, ["channel", "type", "source"]);
  return normalizeChannel(channelStr);
}

/**
 * Convert a TranscriptLike into a Prisma.JsonObject safely (no `any`).
 * If the transcript contains unsupported values (like functions), this will strip them.
 */
function toPrismaJsonObject(t: TranscriptLike): Prisma.JsonObject {
  // JSON round-trip ensures only valid JSON values remain
  const parsed = JSON.parse(JSON.stringify(t)) as unknown;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Prisma.JsonObject;
  }

  // If something unexpected happens, fall back to an empty object
  return {} as Prisma.JsonObject;
}

export async function syncTranscriptsForWorkspace(workspaceId: string): Promise<{ count: number }> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      voiceflowApiKey: true,
      voiceflowProjectId: true,
    },
  });

  if (!ws?.voiceflowApiKey || !ws.voiceflowProjectId) {
    throw new Error("VOICEFLOW_NOT_CONFIGURED");
  }

  const result = await fetchProjectTranscripts(
    { apiKey: ws.voiceflowApiKey },
    ws.voiceflowProjectId,
    {
      // Add filters/pagination once you confirm the real response shape
    }
  );

  let saved = 0;

  for (const t of result.items) {
    const transcriptId = getTranscriptId(t);
    if (!transcriptId) continue;

    const occurredAt = getOccurredAt(t);
    const channel = getChannel(t);

    const payload = toPrismaJsonObject(t);

    await prisma.voiceflowTranscript.upsert({
      where: {
        workspaceId_projectId_transcriptId: {
          workspaceId: ws.id,
          projectId: ws.voiceflowProjectId,
          transcriptId,
        },
      },
      create: {
        workspaceId: ws.id,
        projectId: ws.voiceflowProjectId,
        transcriptId,
        occurredAt,
        channel,
        payload,
      },
      update: {
        occurredAt,
        channel,
        payload,
        syncedAt: new Date(),
      },
    });

    saved += 1;
  }

  return { count: saved };
}