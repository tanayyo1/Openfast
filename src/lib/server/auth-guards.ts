import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

function readDemoAuthCookie() {
  try {
    return cookies().get("rf_demo_auth")?.value ?? null;
  } catch {
    // `cookies()` is request-scoped in Next.js and throws outside HTTP contexts.
    return null;
  }
}

async function tryLocalModeSession() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const demoAuth = readDemoAuthCookie();
  if (demoAuth !== "1") {
    return null;
  }

  // Local development fallback: use first available user.
  const dbUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!dbUser) {
    throw new Error("USER_NOT_SYNCED");
  }

  return {
    user: dbUser,
    supabaseUser: {
      id: dbUser.authId ?? `local-${dbUser.id}`,
      email: dbUser.email,
    },
  };
}

export async function requireSession() {
  const localModeSession = await tryLocalModeSession();
  if (localModeSession) {
    return localModeSession;
  }

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
