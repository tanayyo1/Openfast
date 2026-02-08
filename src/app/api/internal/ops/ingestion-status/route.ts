import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAdminSession } from "@/lib/server/admin-guards";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status =
    code === "FORBIDDEN" ? 403 : code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET() {
  try {
    await requireWorkspaceAdminSession();
  } catch (err) {
    return authError(err);
  }

  const now = Date.now();
  const staleBefore = new Date(now - 24 * 60 * 60 * 1000);

  const [staleSubreddits, freshest, oldest, slotsStaleCount] =
    await Promise.all([
      prisma.subredditCatalog.count({
        where: { lastFetchedAt: { lt: staleBefore } },
      }),
      prisma.subredditCatalog.findMany({
        orderBy: { lastFetchedAt: "desc" },
        take: 10,
        select: { id: true, name: true, lastFetchedAt: true },
      }),
      prisma.subredditCatalog.findMany({
        orderBy: { lastFetchedAt: "asc" },
        take: 10,
        select: { id: true, name: true, lastFetchedAt: true },
      }),
      prisma.subredditCatalog.count({
        where: {
          OR: [
            { timeSlots: { none: {} } },
            { lastFetchedAt: { lt: staleBefore } },
          ],
        },
      }),
    ]);

  return NextResponse.json({
    staleSubreddits,
    staleTimeWindowCandidates: slotsStaleCount,
    freshest,
    oldest,
    generatedAt: new Date().toISOString(),
  });
}
