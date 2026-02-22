import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAdminSession } from "@/lib/server/admin-guards";

type ResetCounts = {
  projects: number;
  redditAccounts: number;
  analyticsEvents: number;
};

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Workspace reset is disabled in production",
        code: "LOCAL_RESET_DISABLED",
      },
      { status: 403 },
    );
  }

  let session;
  try {
    session = await requireWorkspaceAdminSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status =
      code === "WORKSPACE_REQUIRED" ? 400 : code === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  if (session.supabaseUser.id.startsWith("local-")) {
    return NextResponse.json(
      {
        error:
          "Workspace reset requires an authenticated Supabase admin session",
        code: "LOCAL_MODE_SESSION_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  const workspaceId = session.workspaceId;
  const result = await prisma.$transaction(async (tx) => {
    const projects = await tx.project.deleteMany({
      where: { workspaceId },
    });
    const redditAccounts = await tx.redditAccount.deleteMany({
      where: { workspaceId },
    });
    const analyticsEvents = await tx.analyticsEvent.deleteMany({
      where: { workspaceId },
    });

    const counts: ResetCounts = {
      projects: projects.count,
      redditAccounts: redditAccounts.count,
      analyticsEvents: analyticsEvents.count,
    };
    return counts;
  });

  return NextResponse.json(
    {
      ok: true,
      workspaceId,
      reset: result,
    },
    { status: 200 },
  );
}
