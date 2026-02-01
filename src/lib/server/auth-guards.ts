import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  // Get user from our database (linked by authId)
  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    throw new Error("USER_NOT_SYNCED");
  }

  return { user: dbUser, supabaseUser: user };
}

export type WorkspaceSession = Awaited<ReturnType<typeof requireSession>> & {
  workspaceId: string;
};

export async function requireWorkspaceSession() {
  const session = await requireSession();

  // Get user's default workspace
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!workspace) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  return { ...session, workspaceId: workspace.id } as WorkspaceSession;
}
