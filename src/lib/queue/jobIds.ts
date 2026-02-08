export function publishJobId(scheduledPostId: string) {
  return `publish:${scheduledPostId}`;
}

export function metricsFetchJobId(publishedItemId: string) {
  return `metrics_fetch:${publishedItemId}`;
}

export function contentGenerateJobId(draftId: string) {
  return `content_generate:${draftId}`;
}

export function subredditIngestJobId(subredditName: string) {
  return `subreddit_ingest:${subredditName.toLowerCase()}`;
}

export function subredditComputeTimeWindowsJobId(subredditId: string) {
  return `subreddit_compute_time_windows:${subredditId}`;
}

export function recommendationsGenerateJobId(projectId: string) {
  return `recommendations_generate:${projectId}`;
}

export function roadmapGenerateJobId(projectId: string) {
  return `roadmap_generate:${projectId}`;
}

export function riskAccountHealthJobId(redditAccountId: string) {
  return `risk_account_health:${redditAccountId}`;
}

export function riskVisibilityCheckJobId(input: {
  redditAccountId: string;
  publishedItemId?: string | null;
}) {
  if (input.publishedItemId) {
    return `risk_visibility_check:${input.redditAccountId}:${input.publishedItemId}`;
  }
  return `risk_visibility_check:${input.redditAccountId}`;
}
