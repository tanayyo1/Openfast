import type { Job } from "bullmq";
import type { SubredditIngestJobData } from "@/lib/queue/enqueue";
import { ingestSubreddit } from "@/lib/subreddit/intel";

export async function processSubredditIngestJob(
  job: Job<SubredditIngestJobData>,
) {
  const subredditName = job.data.subredditName?.trim();
  if (!subredditName) {
    throw new Error("INVALID_JOB_DATA");
  }

  const subreddit = await ingestSubreddit(subredditName);
  return {
    subredditId: subreddit.id,
    subredditName: subreddit.name,
    status: "ingested",
  };
}
