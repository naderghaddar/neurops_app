-- Phase 2 leads ingestion schema
-- Replaces legacy Lead/LeadCapture with Lead + LeadEvent for Voiceflow webhook ingestion.

-- Drop old tables (legacy)
DROP TABLE IF EXISTS "LeadCapture";
DROP TABLE IF EXISTS "Lead";

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'voiceflow',
    "lastCapturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_workspaceId_phone_key" ON "Lead"("workspaceId", "phone");
CREATE INDEX "Lead_workspaceId_createdAt_idx" ON "Lead"("workspaceId", "createdAt");
CREATE INDEX "Lead_workspaceId_connectionId_idx" ON "Lead"("workspaceId", "connectionId");
CREATE INDEX "Lead_workspaceId_email_idx" ON "Lead"("workspaceId", "email");
CREATE INDEX "LeadEvent_workspaceId_occurredAt_idx" ON "LeadEvent"("workspaceId", "occurredAt");
CREATE INDEX "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");
CREATE INDEX "LeadEvent_workspaceId_connectionId_idx" ON "LeadEvent"("workspaceId", "connectionId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "VoiceflowConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "VoiceflowConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
