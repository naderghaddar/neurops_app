-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "voiceflowApiKey" TEXT,
ADD COLUMN     "voiceflowProjectId" TEXT,
ALTER COLUMN "webhookKey" DROP NOT NULL;
