"use client"

import { useEffect, useMemo, useRef } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

import { ChatBubble } from "./ChatBubble"
import type { TranscriptListItem, TranscriptMessagesResponse } from "./types"

type TranscriptViewerProps = {
  selectedTranscript: TranscriptListItem | null
  messagesData: TranscriptMessagesResponse["data"] | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
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

export function TranscriptViewer({
  selectedTranscript,
  messagesData,
  isLoading,
  error,
  onRetry,
}: TranscriptViewerProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const modality = selectedTranscript?.modality ?? messagesData?.modality ?? null

  const messages = useMemo(() => messagesData?.messages ?? [], [messagesData])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [selectedTranscript?.id, messages.length])

  if (!selectedTranscript) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select a transcript to view messages.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full gap-3">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Transcript Viewer</CardTitle>
          <Badge variant={modality === "voice" ? "secondary" : "outline"}>
            {modality ?? "unknown"}
          </Badge>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Created: {formatDate(selectedTranscript.createdAt)}</p>
          <p>Session: {selectedTranscript.sessionId}</p>
          <p>Duration: {formatDuration(selectedTranscript.durationSec)}</p>
          <p>Credits: {selectedTranscript.credits ?? "-"}</p>
        </div>
        {modality === "voice" ? (
          <Badge variant="secondary" className="w-fit">
            Voice transcript (transcribed)
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {modality === "voice" ? "No transcript available." : "No messages for this session."}
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1 rounded-md border">
            <div ref={scrollViewportRef} className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <ChatBubble key={`${message.at}-${index}`} message={message} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
