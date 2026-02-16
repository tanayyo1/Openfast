import type { Job } from "bullmq";
import type { RiskVisibilityCheckJobData } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { normalizeRedditPermalink } from "@/lib/reddit/permalink";

export async function processRiskVisibilityCheckJob(
  job: Job<RiskVisibilityCheckJobData>,
) {
  const { workspaceId, redditAccountId, publishedItemId, permalink } = job.data;
  if (!workspaceId || !redditAccountId) throw new Error("INVALID_JOB_DATA");

  const account = await prisma.redditAccount.findFirst({
    where: { id: redditAccountId, workspaceId, isActive: true },
    select: { id: true },
  });
  if (!account) throw new Error("REDDIT_ACCOUNT_NOT_FOUND");

  let resolvedPermalink = permalink ?? null;
  if (!resolvedPermalink && publishedItemId) {
    const item = await prisma.publishedItem.findFirst({
      where: { id: publishedItemId, workspaceId, redditAccountId },
      select: { permalink: true },
    });
    resolvedPermalink = item?.permalink ?? null;
  }
  if (!resolvedPermalink) throw new Error("PERMALINK_REQUIRED");

  let visibleLoggedOut: boolean | null = null;
  let fetchStatus: number | null = null;
  try {
    const normalizedPermalink = normalizeRedditPermalink(resolvedPermalink);
    if (!normalizedPermalink) {
      throw new Error("PERMALINK_INVALID");
    }

    const res = await fetch(`${normalizedPermalink}.json`, {
      headers: {
        "User-Agent": process.env.REDDIT_USER_AGENT ?? "ReditFast/0.1",
      },
    });
    fetchStatus = res.status;
    visibleLoggedOut = res.ok;
  } catch {
    fetchStatus = null;
    visibleLoggedOut = null;
  }

  const result =
    visibleLoggedOut === true
      ? "OK"
      : visibleLoggedOut === false
        ? "SUSPICIOUS"
        : "UNKNOWN";

  const created = await prisma.visibilityCheck.create({
    data: {
      workspaceId,
      redditAccountId,
      publishedItemId: publishedItemId ?? null,
      permalink: normalizeRedditPermalink(resolvedPermalink) ?? resolvedPermalink,
      visibleLoggedIn: null,
      visibleLoggedOut,
      visibleAlt: null,
      result,
      signalsJson: {
        httpStatus: fetchStatus,
      },
    },
    select: { id: true, result: true, checkedAt: true },
  });

  return {
    id: created.id,
    result: created.result,
    checkedAt: created.checkedAt.toISOString(),
    status: "captured" as const,
  };
}
