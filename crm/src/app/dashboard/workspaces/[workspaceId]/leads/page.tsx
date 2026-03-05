"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadRow, LeadsListResponse } from "./types";

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString();
}

function truncate(value: string, max = 60) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function matchesSearch(lead: LeadRow, query: string) {
  const q = query.toLowerCase();
  return (
    lead.name.toLowerCase().includes(q) ||
    lead.phone.toLowerCase().includes(q) ||
    (lead.email ?? "").toLowerCase().includes(q) ||
    lead.message.toLowerCase().includes(q) ||
    (lead.source ?? "").toLowerCase().includes(q)
  );
}

export default function LeadsPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const [items, setItems] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    let active = true;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/workspace/${workspaceId}/leads?limit=200&offset=0`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error(`Failed to load leads (${res.status})`);
        }
        const json = (await res.json()) as LeadsListResponse;
        if (!active) return;
        setItems(Array.isArray(json.data?.items) ? json.data.items : []);
        setTotal(typeof json.data?.total === "number" ? json.data.total : 0);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const message = e instanceof Error ? e.message : "Failed to load leads";
        if (active) setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
      controller.abort();
    };
  }, [workspaceId]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return items;
    return items.filter((item) => matchesSearch(item, q));
  }, [items, search]);

  return (
    <main className="p-4 sm:p-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Leads</CardTitle>
            <Badge variant="outline">{total || items.length}</Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search leads by name, phone, email, or message"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Source: All
              </Button>
              <Button variant="outline" size="sm" disabled>
                Stage: New
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No leads yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Captured At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.phone}</TableCell>
                    <TableCell>{lead.email ?? "—"}</TableCell>
                    <TableCell className="max-w-[360px] truncate">
                      {truncate(lead.message, 60)}
                    </TableCell>
                    <TableCell>{lead.source || "voiceflow"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">New</Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(lead.lastCapturedAt || lead.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/dashboard/workspaces/${workspaceId}/leads/${lead.id}`}
                        >
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
