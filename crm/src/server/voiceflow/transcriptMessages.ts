export type ChatMessage = { role: "user" | "assistant"; text: string; at: string };

type UnknownRecord = Record<string, unknown>;
type ChatRole = ChatMessage["role"];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function eqIgnoreCase(value: unknown, expected: string): boolean {
  return typeof value === "string" && value.toLowerCase() === expected.toLowerCase();
}

function lower(value: unknown): string | null {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function readPath(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return current;
}

const ROLE_KEYS = new Set(["role", "from", "sender", "speaker", "author", "participant"]);
const TEXT_KEYS = new Set([
  "message",
  "text",
  "transcript",
  "utterance",
  "input",
  "query",
  "value",
  "content",
  "body",
]);

function findRoleDeep(value: unknown, depth = 0): ChatRole | null {
  if (depth > 4) return null;

  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (ROLE_KEYS.has(key.toLowerCase())) {
        const role = readRoleValue(nested);
        if (role) return role;
      }
      const inner = findRoleDeep(nested, depth + 1);
      if (inner) return inner;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const nested of value) {
      const role = findRoleDeep(nested, depth + 1);
      if (role) return role;
    }
  }

  return null;
}

function findTextDeep(value: unknown, depth = 0): string | null {
  if (depth > 4) return null;

  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (TEXT_KEYS.has(key.toLowerCase())) {
        const direct = asNonEmptyString(nested);
        if (direct) return direct;
      }

      const inner = findTextDeep(nested, depth + 1);
      if (inner) return inner;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const nested of value) {
      const text = findTextDeep(nested, depth + 1);
      if (text) return text;
    }
  }

  return null;
}

function readRoleValue(source: unknown): ChatRole | null {
  const value = lower(source);
  if (value === "user") return "user";
  if (value === "assistant" || value === "agent" || value === "bot" || value === "ai" || value === "system") return "assistant";
  if (value === "caller" || value === "customer" || value === "human") return "user";
  return null;
}

function readHintFromPaths(log: UnknownRecord, paths: readonly (readonly string[])[]): ChatRole | null {
  for (const path of paths) {
    const role = readRoleValue(readPath(log, path));
    if (role) return role;
  }
  return null;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function readRoleHint(log: UnknownRecord): ChatRole | null {
  return (
    readHintFromPaths(log, [
    ["role"],
    ["from"],
    ["sender"],
    ["speaker"],
    ["author"],
    ["data", "role"],
    ["data", "from"],
    ["data", "sender"],
    ["data", "speaker"],
    ["data", "author"],
    ["payload", "role"],
    ["payload", "from"],
    ["payload", "sender"],
    ["payload", "speaker"],
    ["payload", "author"],
    ["data", "payload", "role"],
    ["data", "payload", "from"],
    ["data", "payload", "sender"],
    ["data", "payload", "speaker"],
    ["data", "payload", "author"],
    ]) ?? findRoleDeep(log)
  );
}

function inferRoleFromType(log: UnknownRecord): ChatRole | null {
  const logType = lower(log.type);
  const dataType = lower(readPath(log, ["data", "type"]));

  if (
    logType === "trace" &&
    (dataType === "transcript" ||
      dataType === "speech" ||
      dataType === "stt" ||
      dataType === "asr" ||
      dataType === "input")
  ) {
    return "user";
  }

  if (eqIgnoreCase(log.type, "trace")) return "assistant";
  if (
    eqIgnoreCase(log.type, "action") ||
    eqIgnoreCase(log.type, "request") ||
    eqIgnoreCase(log.type, "input")
  ) {
    return "user";
  }
  return null;
}

function readAssistantText(log: UnknownRecord): string | null {
  const data = isRecord(log.data) ? log.data : null;
  const rootPayload = isRecord(log.payload) ? log.payload : null;

  if (eqIgnoreCase(log.type, "trace") && data && eqIgnoreCase(data.type, "text")) {
    const payload = data.payload;
    const directPayload = asNonEmptyString(payload);
    if (directPayload) return directPayload;
    if (isRecord(payload)) {
      const payloadMessage = asNonEmptyString(payload.message);
      if (payloadMessage) return payloadMessage;
      const payloadText = asNonEmptyString(payload.text);
      if (payloadText) return payloadText;
      const payloadValue = asNonEmptyString(payload.value);
      if (payloadValue) return payloadValue;
      const payloadContent = asNonEmptyString(payload.content);
      if (payloadContent) return payloadContent;
      const payloadBody = asNonEmptyString(payload.body);
      if (payloadBody) return payloadBody;
    }
  }

  if (data) {
    const dataMessage = asNonEmptyString(data.message);
    if (dataMessage) return dataMessage;
  }

  if (rootPayload) {
    const payloadMessage = asNonEmptyString(rootPayload.message);
    if (payloadMessage) return payloadMessage;
  }

  return null;
}

function readUserText(log: UnknownRecord): string | null {
  const data = isRecord(log.data) ? log.data : null;
  const rootPayload = isRecord(log.payload) ? log.payload : null;
  const dataPayload = data && isRecord(data.payload) ? data.payload : null;
  const type = lower(log.type);
  const dataType = lower(readPath(log, ["data", "type"]));

  if (type === "action" && data && eqIgnoreCase(data.type, "text")) {
    const actionText = asNonEmptyString(data.payload);
    if (actionText) return actionText;
  }

  if (type === "request" || type === "input") {
    if (data) {
      const payloadText = asNonEmptyString(data.payload);
      if (payloadText) return payloadText;

      const dataMessage = asNonEmptyString(data.message);
      if (dataMessage) return dataMessage;
    }

    if (rootPayload) {
      const rootMessage = asNonEmptyString(rootPayload.message);
      if (rootMessage) return rootMessage;

      const rootText = asNonEmptyString(rootPayload.text);
      if (rootText) return rootText;
    }
  }

  if (
    type === "trace" &&
    (dataType === "transcript" ||
      dataType === "speech" ||
      dataType === "stt" ||
      dataType === "asr" ||
      dataType === "input")
  ) {
    const traceTranscript = asNonEmptyString(readPath(log, ["data", "payload", "transcript"]));
    if (traceTranscript) return traceTranscript;

    const traceText = asNonEmptyString(readPath(log, ["data", "payload", "text"]));
    if (traceText) return traceText;

    const traceUtterance = asNonEmptyString(readPath(log, ["data", "payload", "utterance"]));
    if (traceUtterance) return traceUtterance;

    const traceInput = asNonEmptyString(readPath(log, ["data", "payload", "input"]));
    if (traceInput) return traceInput;

    const traceQuery = asNonEmptyString(readPath(log, ["data", "payload", "query"]));
    if (traceQuery) return traceQuery;

    const traceMessage = asNonEmptyString(readPath(log, ["data", "payload", "message"]));
    if (traceMessage) return traceMessage;

    const traceValue = asNonEmptyString(readPath(log, ["data", "payload", "value"]));
    if (traceValue) return traceValue;

    const traceContent = asNonEmptyString(readPath(log, ["data", "payload", "content"]));
    if (traceContent) return traceContent;

    const traceBody = asNonEmptyString(readPath(log, ["data", "payload", "body"]));
    if (traceBody) return traceBody;
  }

  if (dataPayload) {
    const transcript = asNonEmptyString(dataPayload.transcript);
    if (transcript) return transcript;

    const payloadText = asNonEmptyString(dataPayload.text);
    if (payloadText) return payloadText;

    const utterance = asNonEmptyString(dataPayload.utterance);
    if (utterance) return utterance;

    const input = asNonEmptyString(dataPayload.input);
    if (input) return input;

    const query = asNonEmptyString(dataPayload.query);
    if (query) return query;

    const value = asNonEmptyString(dataPayload.value);
    if (value) return value;

    const content = asNonEmptyString(dataPayload.content);
    if (content) return content;

    const body = asNonEmptyString(dataPayload.body);
    if (body) return body;
  }

  if (data && eqIgnoreCase(data.type, "text")) {
    const fallbackDataPayload = asNonEmptyString(data.payload);
    if (fallbackDataPayload) return fallbackDataPayload;
  }

  return null;
}

function readFallbackText(log: UnknownRecord): string | null {
  const data = isRecord(log.data) ? log.data : null;
  const rootPayload = isRecord(log.payload) ? log.payload : null;

  const topMessage = asNonEmptyString(log.message);
  if (topMessage) return topMessage;
  const topText = asNonEmptyString(log.text);
  if (topText) return topText;
  const topTranscript = asNonEmptyString(log.transcript);
  if (topTranscript) return topTranscript;
  const topUtterance = asNonEmptyString(log.utterance);
  if (topUtterance) return topUtterance;
  const topInput = asNonEmptyString(log.input);
  if (topInput) return topInput;
  const topQuery = asNonEmptyString(log.query);
  if (topQuery) return topQuery;
  const topValue = asNonEmptyString(log.value);
  if (topValue) return topValue;
  const topContent = asNonEmptyString(log.content);
  if (topContent) return topContent;
  const topBody = asNonEmptyString(log.body);
  if (topBody) return topBody;

  if (data) {
    const dataMessage = asNonEmptyString(data.message);
    if (dataMessage) return dataMessage;

    const dataText = asNonEmptyString(data.text);
    if (dataText) return dataText;

    const dataTranscript = asNonEmptyString(data.transcript);
    if (dataTranscript) return dataTranscript;

    const dataUtterance = asNonEmptyString(data.utterance);
    if (dataUtterance) return dataUtterance;

    const dataInput = asNonEmptyString(data.input);
    if (dataInput) return dataInput;

    const dataQuery = asNonEmptyString(data.query);
    if (dataQuery) return dataQuery;
    const dataValue = asNonEmptyString(data.value);
    if (dataValue) return dataValue;
    const dataContent = asNonEmptyString(data.content);
    if (dataContent) return dataContent;
    const dataBody = asNonEmptyString(data.body);
    if (dataBody) return dataBody;

    const dataPayload = asNonEmptyString(data.payload);
    if (dataPayload) return dataPayload;
  }

  if (rootPayload) {
    const message = asNonEmptyString(rootPayload.message);
    if (message) return message;

    const text = asNonEmptyString(rootPayload.text);
    if (text) return text;
    const value = asNonEmptyString(rootPayload.value);
    if (value) return value;
    const content = asNonEmptyString(rootPayload.content);
    if (content) return content;
    const body = asNonEmptyString(rootPayload.body);
    if (body) return body;
  }

  return findTextDeep(log);
}

export function extractChatMessagesFromLogs(logs: unknown[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const entry of logs) {
    if (!isRecord(entry)) continue;

    const at = normalizeTimestamp(
      typeof entry.createdAt === "string" ? entry.createdAt : entry.timestamp
    );

    const userText = readUserText(entry);
    const assistantText = readAssistantText(entry);
    const fallbackText = readFallbackText(entry);

    const hintedRole = readRoleHint(entry);
    const inferredRole = inferRoleFromType(entry);
    const role: ChatRole | null =
      hintedRole ??
      (userText && !assistantText
        ? "user"
        : assistantText && !userText
          ? "assistant"
          : inferredRole);

    if (!role) {
      continue;
    }

    const chosenTextRaw =
      role === "user"
        ? userText ?? fallbackText ?? assistantText
        : assistantText ?? fallbackText ?? userText;
    if (!chosenTextRaw) continue;

    const text = normalizeText(chosenTextRaw);
    if (!text) continue;

    const prev = messages[messages.length - 1];
    if (prev && prev.role === role && prev.text === text) {
      continue;
    }

    messages.push({ role, text, at });
  }

  return messages;
}

function readStrictUserText(log: UnknownRecord): string | null {
  if (!eqIgnoreCase(log.type, "action")) return null;
  const data = log.data;
  if (!isRecord(data)) return null;
  if (!eqIgnoreCase(data.type, "text")) return null;

  const direct = asNonEmptyString(data.payload);
  if (direct) return direct;

  if (isRecord(data.payload)) {
    return asNonEmptyString(data.payload.message);
  }

  return null;
}

function readStrictAssistantText(log: UnknownRecord): string | null {
  if (!eqIgnoreCase(log.type, "trace")) return null;
  const data = log.data;
  if (!isRecord(data)) return null;
  if (!eqIgnoreCase(data.type, "text")) return null;
  const payload = data.payload;
  const direct = asNonEmptyString(payload);
  if (direct) return direct;
  if (!isRecord(payload)) return null;
  return asNonEmptyString(payload.message);
}

// Chat-only legacy extractor to preserve original behavior.
export function extractStrictChatMessagesFromLogs(logs: unknown[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const entry of logs) {
    if (!isRecord(entry)) continue;

    const at = normalizeTimestamp(
      typeof entry.createdAt === "string" ? entry.createdAt : entry.timestamp
    );
    const userText = readStrictUserText(entry);
    if (userText) {
      messages.push({ role: "user", text: userText, at });
      continue;
    }

    const assistantText = readStrictAssistantText(entry);
    if (!assistantText) continue;

    const prev = messages[messages.length - 1];
    if (prev && prev.role === "assistant" && prev.text === assistantText) {
      continue;
    }

    messages.push({ role: "assistant", text: assistantText, at });
  }

  return messages;
}
