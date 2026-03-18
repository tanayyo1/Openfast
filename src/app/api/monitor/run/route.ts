/**
 * POST /api/monitor/run
 *
 * Called by Cloudflare Worker cron every 15 minutes.
 * Fetches RSS for all active monitored subreddits,
 * stores new posts (dedup by Reddit post ID),
 * and qualifies them with AI.
 *
 * Protected by a shared secret (MONITOR_CRON_SECRET env var).
 * Not a public endpoint.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSubredditRss } from "@/lib/subreddit/rssFeed";
import { qualifyPost } from "@/lib/monitor/qualifyPost";

const MAX_SUBREDDITS_PER_RUN = 20;
const MAX_QUALIFY_PER_RUN = 10; // limit AI calls per cron run to control cost

export async function POST(req: Request) {
  // Auth: only allow calls with the correct secret
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.MONITOR_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active monitored subreddits with their project info
  const monitored = await prisma.monitoredSubreddit.findMany({
    where: { isActive: true },
    take: MAX_SUBREDDITS_PER_RUN,
    include: {
      project: {
        select: { name: true, description: true },
      },
    },
  });

  if (monitored.length === 0) {
    return NextResponse.json({ processed: 0, newPosts: 0, qualified: 0 });
  }

  let totalNewPosts = 0;
  let totalQualified = 0;

  // Fetch all RSS feeds in parallel (5 at a time) to avoid Vercel timeout
  const BATCH_SIZE = 5;
  for (let i = 0; i < monitored.length; i += BATCH_SIZE) {
    const batch = monitored.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (sub) => {
        const posts = await fetchSubredditRss(sub.subreddit);
        return { sub, posts };
      }),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { sub, posts } = result.value;

      for (const post of posts) {
        try {
          const existing = await prisma.monitoredPost.findUnique({
            where: {
              monitoredSubredditId_redditPostId: {
                monitoredSubredditId: sub.id,
                redditPostId: post.id,
              },
            },
            select: { id: true },
          });

          if (existing) continue;

          await prisma.monitoredPost.create({
            data: {
              monitoredSubredditId: sub.id,
              redditPostId: post.id,
              title: post.title,
              url: post.url,
              author: post.author,
              snippet: post.snippet,
              postedAt: post.publishedAt,
            },
          });

          totalNewPosts++;
        } catch {
          continue;
        }
      }
    }
  }

  // Qualify unscored posts with AI (batch limit to control cost)
  const unscored = await prisma.monitoredPost.findMany({
    where: { relevanceScore: null },
    take: MAX_QUALIFY_PER_RUN,
    include: {
      monitoredSubreddit: {
        include: {
          project: { select: { name: true, description: true } },
        },
      },
    },
    orderBy: { discoveredAt: "desc" }, // newest first
  });

  for (const post of unscored) {
    try {
      const result = await qualifyPost({
        postTitle: post.title,
        postSnippet: post.snippet,
        subreddit: post.monitoredSubreddit.subreddit,
        projectName: post.monitoredSubreddit.project.name,
        projectDescription: post.monitoredSubreddit.project.description,
      });

      await prisma.monitoredPost.update({
        where: { id: post.id },
        data: {
          relevanceScore: result.score,
          relevanceReason: result.reason,
        },
      });

      totalQualified++;
    } catch {
      // AI call or DB update failed — skip, will retry next cron
      continue;
    }
  }

  return NextResponse.json({
    processed: monitored.length,
    newPosts: totalNewPosts,
    qualified: totalQualified,
  });
}
