import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function GET() {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const accounts = await prisma.redditAccount.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      redditUsername: true,
      redditUserId: true,
      scopes: true,
      linkKarma: true,
      commentKarma: true,
      accountAge: true,
      safetyTier: true,
      lastSyncAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ items: accounts });
}
