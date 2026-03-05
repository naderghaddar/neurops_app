"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { TranscriptListItem } from "./types"

type TranscriptItemProps = {
  item: TranscriptListItem
  selected: boolean
  onSelect: (transcriptId: string) => void
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return value
  return parsed.toLocaleString()
}

function formatDuration(durationSec: number | null) {
  if (durationSec == null) return "-"
  const minutes = Math.floor(durationSec / 60)
  const seconds = durationSec % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function TranscriptItem({ item, selected, onSelect }: TranscriptItemProps) {
  const modalityLabel = item.modality ?? "unknown"

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-accent" : "hover:bg-accent/60"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{formatDate(item.createdAt)}</span>
        <Badge variant={item.modality === "voice" ? "secondary" : "outline"}>
          {modalityLabel}
        </Badge>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="truncate">Session: {item.sessionId}</p>
        <p>Duration: {formatDuration(item.durationSec)}</p>
        <p>Credits: {item.credits ?? "-"}</p>
        {item.recordingUrl ? <p>?? Recording</p> : null}
      </div>
    </button>
  )
}
