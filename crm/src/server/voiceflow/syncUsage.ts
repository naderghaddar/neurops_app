import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { fetchUsageV2 } from "./client";

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  // Ensures: no functions, no undefined, no Date objects, no "unknown" types
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function syncUsageForWorkspace(workspaceId: string, from: Date, to: Date) {
  const ws = await prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: {
    id: true,
    voiceflowApiKey: true,
    voiceflowProjectId: true,
  },
});

if (!ws?.voiceflowApiKey || !ws.voiceflowProjectId) {
  throw new Error("VOICEFLOW_NOT_CONFIGURED");
}

  const requestBody = {
  query: [
    { name: "interactions" },
    { name: "credits" },
    { name: "duration" },
    { name: "unique_users" },
  ],
  from: from.toISOString(),
  to: to.toISOString(),
  resources: [{ type: "project", id: ws.voiceflowProjectId }],
};

  const data = await fetchUsageV2({ apiKey: ws.voiceflowApiKey }, requestBody);

  const jsonPayload = toPrismaJson(data);

  await prisma.voiceflowUsageSnapshot.upsert({
    where: {
      workspaceId_projectId_from_to: {
        workspaceId,
        projectId: ws.voiceflowProjectId,
        from,
        to,
      },
    },
    create: { workspaceId, projectId: ws.voiceflowProjectId, from, to, payload: jsonPayload },
    update: { payload: jsonPayload, syncedAt: new Date() },
  });

  return data;
}