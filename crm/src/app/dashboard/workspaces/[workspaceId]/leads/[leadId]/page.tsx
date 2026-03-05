"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadDetailResponse, LeadEventRow } from "../types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function findStringByKeys(value: unknown, keys: Set<string>, depth = 0): string | null {
  if (depth > 6) return null;

  if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (keys.has(k.toLowerCase())) {
        const direct = readString(v);
        if (direct) return direct;
      }
      const nested = findStringByKeys(v, keys, depth + 1);
      if (nested) return nested;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findStringByKeys(item, keys, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString();
}

function payloadPreview(payload: unknown): string {
  if (!isRecord(payload)) return "Event payload";

  const message = findStringByKeys(payload, new Set(["message", "problem"]));
  if (message) return message.length > 140 ? `${message.slice(0, 139)}…` : message;

  const type = readString(payload.type);
  if (type) return `Type: ${type}`;

  return "Event payload";
}

function resolveTranscriptHint(event: LeadEventRow | null) {
  if (!event) return null;
  const transcriptId = findStringByKeys(event.payload, new Set(["transcriptid"]));
  if (!transcriptId) return null;
  return {
    transcriptId,
    connectionId: event.connectionId,
  };
}

export default function LeadDetailPage() {
  const params = useParams<{ workspaceId: string; leadId: string }>();
  const workspaceId = params.workspaceId;
  const leadId = params.leadId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeadDetailResponse["data"] | null>(null);

  useEffect(() => {
    if (!workspaceId || !leadId) return;
    let active = true;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/workspace/${workspaceId}/leads/${leadId}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error(`Failed to load lead (${res.status})`);
        }
        const json = (await res.json()) as LeadDetailResponse;
        if (!active) return;
        setData(json.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load lead");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [leadId, workspaceId]);

  const transcriptHint = useMemo(
    () => resolveTranscriptHint(data?.events?.[0] ?? null),
    [data?.events]
  );

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Lead Details</h1>
        <Button asChild variant="outline">
          <Link href={`/dashboard/workspaces/${workspaceId}/leads`}>Back to Leads</Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Lead not found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{data.lead.name}</CardTitle>
                <Badge variant="outline">New</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-medium">Phone:</span> {data.lead.phone}</p>
              <p><span className="font-medium">Email:</span> {data.lead.email ?? "—"}</p>
              <p><span className="font-medium">Message:</span> {data.lead.message}</p>
              <p><span className="font-medium">Source:</span> {data.lead.source || "voiceflow"}</p>
              <p><span className="font-medium">Captured At:</span> {formatDate(data.lead.lastCapturedAt)}</p>
              {transcriptHint ? (
                <div className="pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/dashboard/workspaces/${workspaceId}/connections/${transcriptHint.connectionId}/transcripts?selectedTranscriptId=${encodeURIComponent(
                        transcriptHint.transcriptId
                      )}`}
                    >
                      Open transcript
                    </Link>
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Transcript ID: {transcriptHint.transcriptId}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Lead Events</CardTitle>
            </CardHeader>
            <CardContent>
              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="space-y-4">
                  {data.events.map((event, index) => (
                    <div
                      key={event.id}
                      className={index < data.events.length - 1 ? "space-y-1 border-b pb-4" : "space-y-1"}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{event.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.occurredAt)}
                        </span>
                      </div>
                      <p className="text-sm">{payloadPreview(event.payload)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
