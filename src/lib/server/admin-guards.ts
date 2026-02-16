import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const ADMIN_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN"];

export async function requireWorkspaceAdminSession() {
  const session = await requireWorkspaceSession();
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: session.workspaceId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  if (!ADMIN_ROLES.includes(membership.role)) {
    throw new Error("FORBIDDEN");
  }

  return session;
}
