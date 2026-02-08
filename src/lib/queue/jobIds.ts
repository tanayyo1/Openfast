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
