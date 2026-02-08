export const QUEUE_NAMES = {
  REDDIT_PUBLISH: "reddit.publish",
  REDDIT_METRICS_FETCH: "reddit.metrics_fetch",
  SUBREDDIT_INGEST: "subreddit.ingest",
  SUBREDDIT_COMPUTE_TIME_WINDOWS: "subreddit.compute_time_windows",
  DEAD_LETTER: "dead.letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
