export function publishJobId(scheduledPostId: string) {
  return `publish:${scheduledPostId}`;
}

export function metricsFetchJobId(publishedItemId: string) {
  return `metrics_fetch:${publishedItemId}`;
}
