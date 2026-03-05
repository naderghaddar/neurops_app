type TranscriptPropertyValue = string | number | boolean | null;

type TranscriptProperty = {
  name: string;
  value: TranscriptPropertyValue;
};

type RawTranscript = Record<string, unknown>;

export type TranscriptModality = "chat" | "voice";

export type NormalizedTranscript = {
  id: string;
  sessionId: string;
  projectId: string;
  environmentId: string | null;
  createdAt: string;
  endedAt: string | null;
  expiresAt: string | null;
  recordingUrl: string | null;
  modality: TranscriptModality | null;
  platform: string | null;
  durationSec: number | null;
  credits: number | null;
};

export type TranscriptFilters = {
  from: string | null;
  to: string | null;
  limit: number;
  modality: TranscriptModality | null;
  sessionId: string | null;
  environmentId: string | null;
  cursor: string | null;
};

export type TranscriptPage = {
  items: NormalizedTranscript[];
  nextCursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function toPropertyArray(value: unknown): TranscriptProperty[] {
  if (!Array.isArray(value)) return [];

  const properties: TranscriptProperty[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.name !== "string") continue;
    const propValue = entry.value;
    if (
      typeof propValue === "string" ||
      typeof propValue === "number" ||
      typeof propValue === "boolean" ||
      propValue === null
    ) {
      properties.push({ name: entry.name, value: propValue });
    }
  }

  return properties;
}

function getProperty(properties: TranscriptProperty[], name: string): TranscriptPropertyValue | null {
  const found = properties.find((p) => p.name === name);
  return found ? found.value : null;
}

function getStringProperty(properties: TranscriptProperty[], name: string): string | null {
  const value = getProperty(properties, name);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumberProperty(properties: TranscriptProperty[], name: string): number | null {
  const value = getProperty(properties, name);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseTranscriptFilters(url: URL): { filters?: TranscriptFilters; error?: string } {
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const limitRaw = url.searchParams.get("limit");
  const modalityRaw = url.searchParams.get("modality");
  const sessionId = url.searchParams.get("sessionId");
  const environmentId = url.searchParams.get("environmentId");
  const cursor = url.searchParams.get("cursor");

  const from = fromRaw ? normalizeDate(fromRaw) : null;
  if (fromRaw && !from) return { error: "INVALID_FROM" };

  const to = toRaw ? normalizeDate(toRaw) : null;
  if (toRaw && !to) return { error: "INVALID_TO" };

  let limit = 50;
  if (limitRaw) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      return { error: "INVALID_LIMIT" };
    }
    limit = parsed;
  }

  let modality: TranscriptModality | null = null;
  if (modalityRaw) {
    if (modalityRaw !== "chat" && modalityRaw !== "voice") {
      return { error: "INVALID_MODALITY" };
    }
    modality = modalityRaw;
  }

  return {
    filters: {
      from,
      to,
      limit,
      modality,
      sessionId: sessionId && sessionId.length > 0 ? sessionId : null,
      environmentId: environmentId && environmentId.length > 0 ? environmentId : null,
      cursor: cursor && cursor.length > 0 ? cursor : null,
    },
  };
}

function normalizeTranscript(input: RawTranscript): NormalizedTranscript {
  const properties = toPropertyArray(input.properties);
  const rawModality = getStringProperty(properties, "modality");
  const modality: TranscriptModality | null =
    rawModality === "chat" || rawModality === "voice" ? rawModality : null;

  const createdAt =
    normalizeDate(input.createdAt) ??
    normalizeDate(input.created_at) ??
    new Date(0).toISOString();

  return {
    id:
      asString(input.id) ??
      asString(input.transcriptID) ??
      asString(input.transcriptId) ??
      "",
    sessionId: asString(input.sessionID) ?? asString(input.sessionId) ?? "",
    projectId: asString(input.projectID) ?? asString(input.projectId) ?? "",
    environmentId: asString(input.environmentID) ?? asString(input.environmentId),
    createdAt,
    endedAt: normalizeDate(input.endedAt) ?? normalizeDate(input.ended_at),
    expiresAt: normalizeDate(input.expiresAt) ?? normalizeDate(input.expires_at),
    recordingUrl: asString(input.recordingUrl) ?? asString(input.recordingURL),
    modality,
    platform: getStringProperty(properties, "platform"),
    durationSec: getNumberProperty(properties, "duration"),
    credits: getNumberProperty(properties, "credits"),
  };
}

function compareByCreatedAtDesc(a: NormalizedTranscript, b: NormalizedTranscript): number {
  const left = Date.parse(a.createdAt);
  const right = Date.parse(b.createdAt);
  return right - left;
}

export function normalizeAndPageTranscripts(
  raw: unknown,
  filters: TranscriptFilters
): TranscriptPage {
  const source = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.items)
      ? raw.items
      : isRecord(raw) && Array.isArray(raw.transcripts)
        ? raw.transcripts
        : [];

  const normalized = source
    .filter(isRecord)
    .map(normalizeTranscript)
    .sort(compareByCreatedAtDesc)
    .filter((item) => {
      const createdMs = Date.parse(item.createdAt);
      if (!Number.isFinite(createdMs)) return false;
      if (filters.from && createdMs < Date.parse(filters.from)) return false;
      if (filters.to && createdMs > Date.parse(filters.to)) return false;
      if (filters.modality && item.modality !== filters.modality) return false;
      if (filters.sessionId && item.sessionId !== filters.sessionId) return false;
      if (filters.environmentId && item.environmentId !== filters.environmentId) return false;
      return true;
    });

  let start = 0;
  if (filters.cursor) {
    const idx = normalized.findIndex(
      (item) => item.id === filters.cursor || item.createdAt === filters.cursor
    );
    if (idx >= 0) start = idx + 1;
  }

  const pageItems = normalized.slice(start, start + filters.limit);
  const hasMore = start + filters.limit < normalized.length;
  const last = pageItems[pageItems.length - 1];
  const nextCursor = hasMore && last ? (last.id || last.createdAt) : null;

  return {
    items: pageItems,
    nextCursor,
  };
}

export function parsePaginationParams(url: URL): { limit: number; offset: number } | null {
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  const limit = limitRaw ? Number(limitRaw) : 100;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  if (!Number.isInteger(limit) || limit < 1) return null;
  if (!Number.isInteger(offset) || offset < 0) return null;

  return { limit, offset };
}
