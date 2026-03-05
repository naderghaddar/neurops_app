"use client"

import { cn } from "@/lib/utils"

import type { TranscriptMessage } from "./types"

type ChatBubbleProps = {
  message: TranscriptMessage
}

function formatTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return value
  return parsed.toLocaleString()
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p
          className={cn(
            "mt-1 text-[11px]",
            isUser ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          {formatTime(message.at)}
        </p>
      </div>
    </div>
  )
}
