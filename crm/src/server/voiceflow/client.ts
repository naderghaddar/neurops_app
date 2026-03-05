type VoiceflowClientOpts = {
  apiKey: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

function vfHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

async function parseJson(res: Response): Promise<unknown> {
  // Avoid assuming JSON when errors return HTML/text
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text } as const;
  }
}

/** Narrow unknown into a plain object */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** If response shape can be items/transcripts/array, normalize it */
export type TranscriptLike = Record<string, unknown>;
export type UsageResult = {
  raw: unknown;
};

export type TranscriptSearchResult = {
  items: TranscriptLike[];
  raw: unknown;
};

function normalizeTranscriptResult(raw: unknown): TranscriptSearchResult {
  if (Array.isArray(raw)) {
    // API returned an array directly
    return { items: raw.filter(isRecord), raw };
  }

  if (isRecord(raw)) {
    const maybeItems = raw.items;
    if (Array.isArray(maybeItems)) return { items: maybeItems.filter(isRecord), raw };

    const maybeTranscripts = raw.transcripts;
    if (Array.isArray(maybeTranscripts)) return { items: maybeTranscripts.filter(isRecord), raw };
  }

  return { items: [], raw };
}

export async function fetchProjectTranscripts(
  opts: VoiceflowClientOpts,
  projectId: string,
  body: Record<string, JsonValue> = {}
): Promise<TranscriptSearchResult> {
  const res = await fetch(
    `https://analytics-api.voiceflow.com/v1/transcript/project/${projectId}`,
    {
      method: "POST",
      headers: vfHeaders(opts.apiKey),
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const raw = await parseJson(res);

  if (!res.ok) {
    const msg =
      isRecord(raw) && typeof raw.message === "string"
        ? raw.message
        : `Voiceflow transcripts failed (${res.status})`;
    throw new Error(msg);
  }

  return normalizeTranscriptResult(raw);
}

export type UsageMetric = "interactions" | "credits" | "duration" | "unique_users";

export type UsageV2Request = {
  query: { name: UsageMetric }[];
  from: string;
  to: string;
  resources: { type: "project"; id: string }[];
};

export async function fetchUsageV2(
  opts: VoiceflowClientOpts,
  body: UsageV2Request
): Promise<UsageResult> {
  const res = await fetch(`https://analytics-api.voiceflow.com/v2/query/usage`, {
    method: "POST",
    headers: vfHeaders(opts.apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await parseJson(res);

  if (!res.ok) {
    const msg =
      isRecord(raw) && typeof raw.message === "string"
        ? raw.message
        : `Voiceflow usage failed (${res.status})`;
    throw new Error(msg);
  }

  return { raw };
}