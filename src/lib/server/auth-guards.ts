import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export type WorkspaceSession = Awaited<ReturnType<typeof requireSession>> & {
  workspaceId: string;
};

export async function requireWorkspaceSession() {
  const session = await requireSession();
  if (!session.workspaceId) {
    throw new Error("WORKSPACE_REQUIRED");
  }
  // Help TS understand that workspaceId is present after the guard.
  return session as WorkspaceSession;
}
