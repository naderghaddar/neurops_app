import { prisma } from "@/lib/prisma";

export type UserWorkspace = {
  workspaceId: string;
  workspaceKey: string;
  workspaceName: string;
};

export async function getUserWorkspace(userId: string): Promise<UserWorkspace | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      workspaceId: true,
      workspace: {
        select: {
          workspaceKey: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    workspaceId: membership.workspaceId,
    workspaceKey: membership.workspace.workspaceKey,
    workspaceName: membership.workspace.name,
  };
}
