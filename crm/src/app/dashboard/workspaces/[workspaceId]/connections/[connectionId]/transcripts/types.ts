export type TranscriptModality = "chat" | "voice" | null

export type TranscriptListItem = {
  id: string
  sessionId: string
  createdAt: string
  modality: TranscriptModality
  durationSec: number | null
  credits: number | null
  recordingUrl: string | null
}

export type TranscriptListResponse = {
  data: {
    items: TranscriptListItem[]
    pageInfo?: {
      nextCursor: string | null
    }
  }
}

export type TranscriptMessage = {
  role: "user" | "assistant"
  text: string
  at: string
}

export type TranscriptMessagesResponse = {
  data: {
    transcriptId: string
    modality: TranscriptModality
    recordingUrl: string | null
    messages: TranscriptMessage[]
  }
}
