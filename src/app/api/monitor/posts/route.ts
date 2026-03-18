/**
 * GET /api/monitor/posts
 *
 * Returns monitored posts for the current workspace.
 * Sorted by relevance score (highest first), then by discovery time.
 * Only returns posts scored 40+ by default (query param ?minScore=N to override).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function GET(req: Request) {
  const ctx = await requireWorkspaceSession();
  const { searchParams } = new URL(req.url);
  const minScore = Math.max(0, Number(searchParams.get("minScore") ?? 40));

  const posts = await prisma.monitoredPost.findMany({
    where: {
      monitoredSubreddit: { workspaceId: ctx.workspaceId },
      relevanceScore: { gte: minScore },
    },
    include: {
      monitoredSubreddit: {
        select: { subreddit: true, projectId: true },
      },
    },
    orderBy: [{ relevanceScore: "desc" }, { discoveredAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({
    items: posts.map((p) => ({
      id: p.id,
      subreddit: p.monitoredSubreddit.subreddit,
      projectId: p.monitoredSubreddit.projectId,
      redditPostId: p.redditPostId,
      title: p.title,
      url: p.url,
      author: p.author,
      snippet: p.snippet,
      relevanceScore: p.relevanceScore,
      relevanceReason: p.relevanceReason,
      draftReply: p.draftReply,
      draftReplyAt: p.draftReplyAt,
      postedAt: p.postedAt,
      discoveredAt: p.discoveredAt,
    })),
  });
}
