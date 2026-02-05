export const QUEUE_NAMES = {
  REDDIT_PUBLISH: "reddit.publish",
  REDDIT_METRICS_FETCH: "reddit.metrics_fetch",
  DEAD_LETTER: "dead.letter",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
