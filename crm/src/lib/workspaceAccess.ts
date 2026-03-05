import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";

export async function requireWorkspaceMember(params: {
  userId: string;
  workspaceId: string;
}) {
  const { userId, workspaceId } = params;

  if (!userId) {
    throw httpError(401, "UNAUTHENTICATED");
  }

  if (!workspaceId) {
    throw httpError(400, "MISSING_WORKSPACE_ID");
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!member) {
    throw httpError(403, "FORBIDDEN");
  }

  return member;
}
