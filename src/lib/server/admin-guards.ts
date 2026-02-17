import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireSession,
  requireWorkspaceSession,
} from "@/lib/server/auth-guards";

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

function parseAdminEmails() {
  const raw = process.env.INTERNAL_OPS_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requirePlatformAdminSession() {
  const session = await requireSession();
  const allowedEmails = parseAdminEmails();
  if (!allowedEmails.length) {
    throw new Error("PLATFORM_ADMIN_NOT_CONFIGURED");
  }

  const userEmail = session.user.email.toLowerCase();
  if (!allowedEmails.includes(userEmail)) {
    throw new Error("FORBIDDEN");
  }

  return session;
}
