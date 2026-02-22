function sanitizeSegment(value: string) {
  return value.replace(/:/g, "_").trim();
}

function buildJobId(namespace: string, ...segments: string[]) {
  const safeSegments = [namespace, ...segments]
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0);
  return safeSegments.join("__");
}

export function publishJobId(scheduledPostId: string) {
  return buildJobId("publish", scheduledPostId);
}

export function metricsFetchJobId(publishedItemId: string) {
  return buildJobId("metrics_fetch", publishedItemId);
}

export function redditAdsSyncJobId(input: {
  campaignId: string;
  status: string;
  version: string;
}) {
  return buildJobId(
    "reddit_ads_sync",
    input.campaignId,
    input.status,
    input.version,
  );
}

export function contentGenerateJobId(draftId: string) {
  return buildJobId("content_generate", draftId);
}

export function subredditIngestJobId(subredditName: string) {
  return buildJobId("subreddit_ingest", subredditName.toLowerCase());
}

export function subredditComputeTimeWindowsJobId(subredditId: string) {
  return buildJobId("subreddit_compute_time_windows", subredditId);
}

export function recommendationsGenerateJobId(projectId: string) {
  return buildJobId("recommendations_generate", projectId);
}

export function roadmapGenerateJobId(projectId: string) {
  return buildJobId("roadmap_generate", projectId);
}

export function riskAccountHealthJobId(redditAccountId: string) {
  return buildJobId("risk_account_health", redditAccountId);
}

export function riskVisibilityCheckJobId(input: {
  redditAccountId: string;
  publishedItemId?: string | null;
}) {
  if (input.publishedItemId) {
    return buildJobId(
      "risk_visibility_check",
      input.redditAccountId,
      input.publishedItemId,
    );
  }
  return buildJobId("risk_visibility_check", input.redditAccountId);
}
