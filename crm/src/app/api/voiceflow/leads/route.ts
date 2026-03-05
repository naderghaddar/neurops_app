import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getErrorStatus } from "@/lib/errors";

/**
 * Local test example:
 * curl -X POST http://localhost:3000/api/voiceflow/leads \
 *   -H "Content-Type: application/json" \
 *   -H "X-Webhook-Secret: $VF_WEBHOOK_SECRET" \
 *   -d "{\"connectionId\":\"<uuid>\",\"lead\":{\"name\":\"Jane\",\"phone\":\"+15551234567\",\"email\":\"jane@example.com\",\"message\":\"Need pricing\"}}"
 */

type UnknownRecord = Record<string, unknown>;

type LeadPayload = {
  name: string;
  phone: string;
  email: string | null;
  message: string;
};

type LeadIngestionBody = {
  connectionId: string;
  projectId: string | null;
  transcriptId: string | null;
  sessionId: string | null;
  modality: "chat" | "voice" | null;
  lead: LeadPayload;
  custom: UnknownRecord | null;
  occurredAt: Date | null;
  raw: UnknownRecord;
  emailProvided: boolean;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return readNonEmptyString(value);
}

function parseOccurredAt(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

function parseBody(input: unknown): { data?: LeadIngestionBody; error?: string } {
  if (!isRecord(input)) return { error: "INVALID_JSON_BODY" };

  const connectionId = readNonEmptyString(input.connectionId);
  if (!connectionId) return { error: "MISSING_CONNECTION_ID" };

  const leadRaw = input.lead;
  if (!isRecord(leadRaw)) return { error: "MISSING_LEAD" };

  const name = readNonEmptyString(leadRaw.name);
  if (!name) return { error: "MISSING_LEAD_NAME" };

  const phone = readNonEmptyString(leadRaw.phone);
  if (!phone) return { error: "MISSING_LEAD_PHONE" };

  const message = readNonEmptyString(leadRaw.message);
  if (!message) return { error: "MISSING_LEAD_MESSAGE" };

  const emailProvided = Object.prototype.hasOwnProperty.call(leadRaw, "email");
  let email: string | null = null;
  if (emailProvided) {
    if (leadRaw.email === null || leadRaw.email === undefined) {
      email = null;
    } else {
      const parsedEmail = readNonEmptyString(leadRaw.email);
      if (!parsedEmail) return { error: "INVALID_LEAD_EMAIL" };
      email = parsedEmail;
    }
  }

  const modalityRaw = input.modality;
  const modality =
    modalityRaw === "chat" || modalityRaw === "voice" || modalityRaw === null || modalityRaw === undefined
      ? (modalityRaw ?? null)
      : null;
  if (modalityRaw !== undefined && modality === null && modalityRaw !== null) {
    return { error: "INVALID_MODALITY" };
  }

  const occurredAt = parseOccurredAt(input.occurredAt);
  if (input.occurredAt !== undefined && input.occurredAt !== null && !occurredAt) {
    return { error: "INVALID_OCCURRED_AT" };
  }

  const custom = input.custom === undefined ? null : isRecord(input.custom) ? input.custom : null;
  if (input.custom !== undefined && input.custom !== null && !custom) {
    return { error: "INVALID_CUSTOM" };
  }

  return {
    data: {
      connectionId,
      projectId: parseOptionalString(input.projectId),
      transcriptId: parseOptionalString(input.transcriptId),
      sessionId: parseOptionalString(input.sessionId),
      modality,
      lead: {
        name,
        phone: phone.trim(),
        email,
        message,
      },
      custom,
      occurredAt,
      raw: input,
      emailProvided,
    },
  };
}

export async function POST(req: NextRequest) {
  const sentSecret = req.headers.get("x-webhook-secret");
  const expectedSecret = process.env.VF_WEBHOOK_SECRET;

  if (!sentSecret || !expectedSecret || sentSecret !== expectedSecret) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON_BODY" }, { status: 400 });
  }

  const parsed = parseBody(parsedJson);
  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error ?? "INVALID_PAYLOAD" }, { status: 400 });
  }

  const body = parsed.data;
  const occurredAt = body.occurredAt ?? new Date();

  try {
    const connection = await prisma.voiceflowConnection.findFirst({
      where: {
        id: body.connectionId,
        isActive: true,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
      },
    });

    if (!connection) {
      return NextResponse.json({ error: "CONNECTION_NOT_FOUND" }, { status: 404 });
    }

    const lead = await prisma.lead.upsert({
      where: {
        workspaceId_phone: {
          workspaceId: connection.workspaceId,
          phone: body.lead.phone,
        },
      },
      create: {
        workspaceId: connection.workspaceId,
        connectionId: connection.id,
        name: body.lead.name,
        phone: body.lead.phone,
        email: body.lead.email,
        message: body.lead.message,
        source: "voiceflow",
        lastCapturedAt: occurredAt,
      },
      update: {
        connectionId: connection.id,
        name: body.lead.name,
        message: body.lead.message,
        lastCapturedAt: occurredAt,
        ...(body.emailProvided ? { email: body.lead.email } : {}),
      },
      select: {
        id: true,
      },
    });

    await prisma.leadEvent.create({
      data: {
        workspaceId: connection.workspaceId,
        leadId: lead.id,
        connectionId: connection.id,
        type: "lead.captured",
        occurredAt,
        payload: body.raw,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        leadId: lead.id,
        workspaceId: connection.workspaceId,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const status = getErrorStatus(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status });
  }
}
