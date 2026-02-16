import { NextResponse } from "next/server";
import { QUEUE_NAMES } from "@/lib/queue/constants";
import {
  getContentGenerateQueue,
  getDeadLetterQueue,
  getMetricsFetchQueue,
  getPublishQueue,
  getRecommendationsGenerateQueue,
  getRiskAccountHealthQueue,
  getRiskVisibilityCheckQueue,
  getRoadmapGenerateQueue,
  getSubredditComputeTimeWindowsQueue,
  getSubredditIngestQueue,
} from "@/lib/queue/queues";
import { requireWorkspaceAdminSession } from "@/lib/server/admin-guards";
import { emitOpsAlert } from "@/lib/ops/alerts";

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

  const queues = [
    [QUEUE_NAMES.REDDIT_PUBLISH, getPublishQueue()],
    [QUEUE_NAMES.REDDIT_METRICS_FETCH, getMetricsFetchQueue()],
    [QUEUE_NAMES.CONTENT_GENERATE, getContentGenerateQueue()],
    [QUEUE_NAMES.RECOMMENDATIONS_GENERATE, getRecommendationsGenerateQueue()],
    [QUEUE_NAMES.ROADMAP_GENERATE, getRoadmapGenerateQueue()],
    [QUEUE_NAMES.SUBREDDIT_INGEST, getSubredditIngestQueue()],
    [
      QUEUE_NAMES.SUBREDDIT_COMPUTE_TIME_WINDOWS,
      getSubredditComputeTimeWindowsQueue(),
    ],
    [QUEUE_NAMES.RISK_ACCOUNT_HEALTH, getRiskAccountHealthQueue()],
    [QUEUE_NAMES.RISK_VISIBILITY_CHECK, getRiskVisibilityCheckQueue()],
    [QUEUE_NAMES.DEAD_LETTER, getDeadLetterQueue()],
  ] as const;

  const status = await Promise.all(
    queues.map(async ([name, queue]) => ({
      name,
      counts: await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
      ),
    })),
  );

  const backlogThreshold = Number(
    process.env.QUEUE_BACKLOG_ALERT_THRESHOLD ?? 1000,
  );
  for (const queue of status) {
    const waiting = queue.counts.waiting ?? 0;
    if (waiting >= backlogThreshold) {
      await emitOpsAlert({
        type: "queue.backlog",
        level: "warn",
        message: "Queue backlog threshold exceeded",
        details: { queue: queue.name, waiting, backlogThreshold },
      });
    }
  }

  return NextResponse.json({
    queues: status,
    alertThreshold: backlogThreshold,
    generatedAt: new Date().toISOString(),
  });
}
