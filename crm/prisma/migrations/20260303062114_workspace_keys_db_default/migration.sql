/*
  Warnings:

  - The `webhookKey` column on the `Workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[workspaceKey]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable

/* Generate webhook key for workspaces */
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
ALTER TABLE "Workspace" ADD COLUMN     "workspaceKey" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "webhookKey",
ADD COLUMN     "webhookKey" UUID DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_workspaceKey_key" ON "Workspace"("workspaceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_webhookKey_key" ON "Workspace"("webhookKey");
