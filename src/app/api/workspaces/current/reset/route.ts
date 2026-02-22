import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

type ResetCounts = {
  projects: number;
  redditAccounts: number;
  analyticsEvents: number;
};

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const [rawKey, ...rest] = segment.trim().split("=");
    if (rawKey !== name) continue;
    return rest.join("=");
  }
  return null;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Workspace reset is disabled in production",
        code: "LOCAL_RESET_DISABLED",
      },
      { status: 403 },
    );
  }

  const demoAuth = readCookieValue(req.headers.get("cookie"), "rf_demo_auth");
  if (demoAuth !== "1") {
    return NextResponse.json(
      {
        error: "Local mode session required",
        code: "LOCAL_MODE_REQUIRED",
      },
      { status: 403 },
    );
  }

  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
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
