import type { Job } from "bullmq";
import { ScheduledStatus } from "@prisma/client";
import type { PublishJobData } from "@/lib/queue/enqueue";
import { enqueueMetricsFetchJob } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { assertScheduledStatusTransition } from "@/lib/scheduling/statusMachine";

export async function processPublishJob(job: Job<PublishJobData>) {
  const { scheduledPostId } = job.data;
  if (!scheduledPostId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: { draft: true, subreddit: true },
  });

  if (!scheduledPost) {
    throw new Error("SCHEDULED_POST_NOT_FOUND");
  }

  // Idempotency: if already published, return the existing published item.
  if (
    scheduledPost.status === ScheduledStatus.PUBLISHED &&
    scheduledPost.publishedItemId
  ) {
    return {
      scheduledPostId,
      publishedItemId: scheduledPost.publishedItemId,
      status: "already_published",
    };
  }

  // Only allow publishing from SCHEDULED or FAILED_RETRYABLE.
  if (
    scheduledPost.status !== ScheduledStatus.SCHEDULED &&
    scheduledPost.status !== ScheduledStatus.FAILED_RETRYABLE
  ) {
    throw new Error(`INVALID_SCHEDULED_STATUS:${scheduledPost.status}`);
  }

  assertScheduledStatusTransition(
    scheduledPost.status,
    ScheduledStatus.PUBLISHING,
  );

  await prisma.scheduledPost.update({
    where: { id: scheduledPostId },
    data: {
      status: ScheduledStatus.PUBLISHING,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  // Stub "publish" result (no Reddit API call in RED-33).
  const redditId = scheduledPostId.slice(-8);
  const redditFullname = `t3_${redditId}`;

  const published = await prisma.publishedItem.create({
    data: {
      workspaceId: scheduledPost.workspaceId,
      redditAccountId: scheduledPost.redditAccountId,
      subredditId: scheduledPost.subredditId,
      scheduledPostId: scheduledPost.id,
      type: "POST",
      redditFullname,
      redditId,
      permalink: `/r/${scheduledPost.subreddit.name}/comments/${redditId}`,
      url: null,
      titleSnapshot: scheduledPost.draft.title,
      bodySnapshot: scheduledPost.draft.body,
    },
  });

  await prisma.scheduledPost.update({
    where: { id: scheduledPostId },
    data: {
      status: ScheduledStatus.PUBLISHED,
      publishedAt: new Date(),
      publishedItemId: published.id,
      lastError: null,
    },
  });

  // Trigger a metrics refresh job.
  await enqueueMetricsFetchJob(
    { publishedItemId: published.id },
    { delay: 30_000 },
  );

  return {
    scheduledPostId,
    publishedItemId: published.id,
    status: "published",
  };
}
