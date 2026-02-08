export const QUEUE_NAMES = {
  REDDIT_PUBLISH: "reddit.publish",
  REDDIT_METRICS_FETCH: "reddit.metrics_fetch",
  CONTENT_GENERATE: "content.generate",
  RECOMMENDATIONS_GENERATE: "recommendations.generate",
  ROADMAP_GENERATE: "roadmap.generate",
  SUBREDDIT_INGEST: "subreddit.ingest",
  SUBREDDIT_COMPUTE_TIME_WINDOWS: "subreddit.compute_time_windows",
  RISK_ACCOUNT_HEALTH: "risk.account_health",
  RISK_VISIBILITY_CHECK: "risk.visibility_check",
  DEAD_LETTER: "dead.letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
