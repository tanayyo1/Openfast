import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  // Check if Supabase is configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

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

  // Get workspace through membership (supports owners AND members)
  // Ordered by createdAt to ensure deterministic selection
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });

  if (!membership) {
    throw new Error("WORKSPACE_REQUIRED");
  }

  return {
    ...session,
    workspaceId: membership.workspace.id,
  } as WorkspaceSession;
}
