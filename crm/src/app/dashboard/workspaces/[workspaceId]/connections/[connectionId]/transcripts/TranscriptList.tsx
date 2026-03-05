"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

import { TranscriptItem } from "./TranscriptItem"
import type { TranscriptListItem } from "./types"

type TranscriptListProps = {
  items: TranscriptListItem[]
  selectedId: string | null
  isLoading: boolean
  isLoadingMore: boolean
  hasNextPage: boolean
  error: string | null
  onRetry: () => void
  onSelect: (transcriptId: string) => void
  onLoadMore: () => void
}

export function TranscriptList({
  items,
  selectedId,
  isLoading,
  isLoadingMore,
  hasNextPage,
  error,
  onRetry,
  onSelect,
  onLoadMore,
}: TranscriptListProps) {
  return (
    <Card className="h-full gap-3">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Transcripts</CardTitle>
          <Badge variant="outline">{items.length}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No transcripts yet.
          </div>
        ) : (
          <>
            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                {items.map((item) => (
                  <TranscriptItem
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </ScrollArea>

            {hasNextPage ? (
              <Button type="button" variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading..." : "Load more"}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
