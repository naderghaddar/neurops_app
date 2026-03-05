-- CreateTable
CREATE TABLE "VoiceflowTranscript" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "channel" "ConversationChannel",
    "payload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceflowTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceflowUsageSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceflowUsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceflowTranscript_workspaceId_projectId_syncedAt_idx" ON "VoiceflowTranscript"("workspaceId", "projectId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceflowTranscript_workspaceId_projectId_transcriptId_key" ON "VoiceflowTranscript"("workspaceId", "projectId", "transcriptId");

-- CreateIndex
CREATE INDEX "VoiceflowUsageSnapshot_workspaceId_projectId_syncedAt_idx" ON "VoiceflowUsageSnapshot"("workspaceId", "projectId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceflowUsageSnapshot_workspaceId_projectId_from_to_key" ON "VoiceflowUsageSnapshot"("workspaceId", "projectId", "from", "to");

-- AddForeignKey
ALTER TABLE "VoiceflowTranscript" ADD CONSTRAINT "VoiceflowTranscript_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceflowUsageSnapshot" ADD CONSTRAINT "VoiceflowUsageSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
