"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"

import { TranscriptList } from "./TranscriptList"
import { TranscriptViewer } from "./TranscriptViewer"
import type { TranscriptListItem, TranscriptMessagesResponse } from "./types"

type ParsedListResult = {
  items: TranscriptListItem[]
  nextCursor: string | null
}

function isTranscriptListItem(value: unknown): value is TranscriptListItem {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.sessionId === "string" &&
    typeof record.createdAt === "string" &&
    (record.modality === "chat" || record.modality === "voice" || record.modality === null) &&
    (typeof record.durationSec === "number" || record.durationSec === null) &&
    (typeof record.credits === "number" || record.credits === null) &&
    (typeof record.recordingUrl === "string" || record.recordingUrl === null)
  )
}

function parseTranscriptListResponse(value: unknown): ParsedListResult {
  if (!value || typeof value !== "object") {
    return { items: [], nextCursor: null }
  }

  const root = value as Record<string, unknown>
  if (!root.data || typeof root.data !== "object") {
    return { items: [], nextCursor: null }
  }

  const data = root.data as Record<string, unknown>
  const itemsRaw = data.items
  const items = Array.isArray(itemsRaw) ? itemsRaw.filter(isTranscriptListItem) : []

  let nextCursor: string | null = null
  if (data.pageInfo && typeof data.pageInfo === "object") {
    const pageInfo = data.pageInfo as Record<string, unknown>
    nextCursor = typeof pageInfo.nextCursor === "string" ? pageInfo.nextCursor : null
  }

  return { items, nextCursor }
}

function parseTranscriptMessagesResponse(
  value: unknown
): TranscriptMessagesResponse["data"] | null {
  if (!value || typeof value !== "object") return null
  const root = value as Record<string, unknown>

  if (!root.data || typeof root.data !== "object") return null
  const data = root.data as Record<string, unknown>

  if (
    typeof data.transcriptId !== "string" ||
    (data.modality !== "chat" && data.modality !== "voice" && data.modality !== null) ||
    (typeof data.recordingUrl !== "string" && data.recordingUrl !== null) ||
    !Array.isArray(data.messages)
  ) {
    return null
  }

  const messages = data.messages
    .filter((message): message is { role: "user" | "assistant"; text: string; at: string } => {
      if (!message || typeof message !== "object") return false
      const m = message as Record<string, unknown>
      return (
        (m.role === "user" || m.role === "assistant") &&
        typeof m.text === "string" &&
        typeof m.at === "string"
      )
    })
    .map((message) => ({ role: message.role, text: message.text, at: message.at }))

  return {
    transcriptId: data.transcriptId,
    modality: data.modality,
    recordingUrl: data.recordingUrl,
    messages,
  }
}

export default function TranscriptsPage() {
  const params = useParams<{ workspaceId: string; connectionId: string }>()
  const workspaceId = params.workspaceId
  const connectionId = params.connectionId

  const [items, setItems] = useState<TranscriptListItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [isListLoading, setIsListLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [listError, setListError] = useState<string | null>(null)

  const [messagesData, setMessagesData] = useState<TranscriptMessagesResponse["data"] | null>(null)
  const [isMessagesLoading, setIsMessagesLoading] = useState<boolean>(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  const messageAbortRef = useRef<AbortController | null>(null)

  const selectedTranscript = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  )

  const fetchTranscripts = useCallback(
    async (cursor?: string) => {
      if (!workspaceId || !connectionId) return
      const isLoadMore = Boolean(cursor)
      setListError(null)
      if (isLoadMore) {
        setIsLoadingMore(true)
      } else {
        setIsListLoading(true)
      }

      try {
        const paramsValue = new URLSearchParams()
        if (cursor) paramsValue.set("cursor", cursor)

        const url = `/api/workspace/${workspaceId}/voiceflow/connections/${connectionId}/transcripts${
          paramsValue.toString() ? `?${paramsValue.toString()}` : ""
        }`

        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Failed to load transcripts (${response.status})`)
        }

        const json = (await response.json()) as unknown
        const parsed = parseTranscriptListResponse(json)

        setItems((current) => (isLoadMore ? [...current, ...parsed.items] : parsed.items))
        setNextCursor(parsed.nextCursor)

        if (!isLoadMore && parsed.items.length > 0) {
          setSelectedId((current) => current ?? parsed.items[0].id)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load transcripts"
        setListError(message)
      } finally {
        setIsListLoading(false)
        setIsLoadingMore(false)
      }
    },
    [connectionId, workspaceId]
  )

  const fetchMessages = useCallback(
    async (transcriptId: string) => {
      if (!workspaceId || !connectionId) return
      messageAbortRef.current?.abort()
      const controller = new AbortController()
      messageAbortRef.current = controller

      setIsMessagesLoading(true)
      setMessagesError(null)

      try {
        const url = `/api/workspace/${workspaceId}/voiceflow/connections/${connectionId}/transcripts/${transcriptId}/messages`

        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to load transcript messages (${response.status})`)
        }

        const json = (await response.json()) as unknown
        const parsed = parseTranscriptMessagesResponse(json)
        if (!parsed) {
          throw new Error("Unexpected transcript messages response")
        }

        setMessagesData(parsed)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        const message =
          error instanceof Error ? error.message : "Failed to load transcript messages"
        setMessagesError(message)
        setMessagesData(null)
      } finally {
        if (messageAbortRef.current === controller) {
          setIsMessagesLoading(false)
        }
      }
    },
    [connectionId, workspaceId]
  )

  useEffect(() => {
    if (!workspaceId || !connectionId) return
    void fetchTranscripts()
  }, [connectionId, fetchTranscripts, workspaceId])

  useEffect(() => {
    if (!selectedId) {
      setMessagesData(null)
      return
    }
    void fetchMessages(selectedId)
  }, [fetchMessages, selectedId])

  useEffect(() => {
    return () => {
      messageAbortRef.current?.abort()
    }
  }, [])

  return (
    <main className="h-[calc(100vh-4rem)] min-h-[640px] p-4 sm:p-6">
      <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <TranscriptList
          items={items}
          selectedId={selectedId}
          isLoading={isListLoading}
          isLoadingMore={isLoadingMore}
          hasNextPage={Boolean(nextCursor)}
          error={listError}
          onRetry={() => void fetchTranscripts()}
          onSelect={setSelectedId}
          onLoadMore={() => {
            if (nextCursor) {
              void fetchTranscripts(nextCursor)
            }
          }}
        />

        <TranscriptViewer
          selectedTranscript={selectedTranscript}
          messagesData={messagesData}
          isLoading={isMessagesLoading}
          error={messagesError}
          onRetry={() => {
            if (selectedId) {
              void fetchMessages(selectedId)
            }
          }}
        />
      </div>
    </main>
  )
}
