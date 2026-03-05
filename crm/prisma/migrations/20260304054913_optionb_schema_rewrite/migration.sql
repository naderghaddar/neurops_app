/*
  Warnings:

  - You are about to drop the column `voiceflowApiKey` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `voiceflowProjectId` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the `Contact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VoiceflowTranscript` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VoiceflowUsageSnapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "VoiceflowChannel" AS ENUM ('CHAT', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'WEB', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'WON', 'LOST');

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_contactId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_contactId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "VoiceflowTranscript" DROP CONSTRAINT "VoiceflowTranscript_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "VoiceflowUsageSnapshot" DROP CONSTRAINT "VoiceflowUsageSnapshot_workspaceId_fkey";

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "voiceflowApiKey",
DROP COLUMN "voiceflowProjectId";

-- DropTable
DROP TABLE "Contact";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "Event";

-- DropTable
DROP TABLE "VoiceflowTranscript";

-- DropTable
DROP TABLE "VoiceflowUsageSnapshot";

-- DropEnum
DROP TYPE "ConversationChannel";

-- CreateTable
CREATE TABLE "VoiceflowConnection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environment" TEXT,
    "apiKeyCiphertext" TEXT NOT NULL,
    "channel" "VoiceflowChannel" NOT NULL DEFAULT 'CHAT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceflowConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "voiceflowConnectionId" UUID,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "igHandle" TEXT,
    "source" "VoiceflowChannel",
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceflowConnection_workspaceId_idx" ON "VoiceflowConnection"("workspaceId");

-- CreateIndex
CREATE INDEX "VoiceflowConnection_workspaceId_isActive_idx" ON "VoiceflowConnection"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "VoiceflowConnection_workspaceId_projectId_idx" ON "VoiceflowConnection"("workspaceId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceflowConnection_workspaceId_projectId_name_key" ON "VoiceflowConnection"("workspaceId", "projectId", "name");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_createdAt_idx" ON "Lead"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_status_idx" ON "Lead"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_email_idx" ON "Lead"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Lead_workspaceId_phone_idx" ON "Lead"("workspaceId", "phone");

-- CreateIndex
CREATE INDEX "LeadCapture_workspaceId_receivedAt_idx" ON "LeadCapture"("workspaceId", "receivedAt");

-- CreateIndex
CREATE INDEX "LeadCapture_leadId_idx" ON "LeadCapture"("leadId");

-- CreateIndex
CREATE INDEX "LeadCapture_workspaceId_externalId_idx" ON "LeadCapture"("workspaceId", "externalId");

-- AddForeignKey
ALTER TABLE "VoiceflowConnection" ADD CONSTRAINT "VoiceflowConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_voiceflowConnectionId_fkey" FOREIGN KEY ("voiceflowConnectionId") REFERENCES "VoiceflowConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
