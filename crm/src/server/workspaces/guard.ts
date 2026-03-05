import { prisma } from "@/server/db";

export async function requireWorkspaceAccess(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true },
  });

  if (!membership) throw new Error("FORBIDDEN");

  const { workspace } = membership;
  if (!workspace.voiceflowApiKey || !workspace.voiceflowProjectId) {
    throw new Error("VOICEFLOW_NOT_CONFIGURED");
  }

  return { membership, workspace };
}