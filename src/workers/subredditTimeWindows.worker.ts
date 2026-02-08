import type { Job } from "bullmq";
import type { SubredditComputeTimeWindowsJobData } from "@/lib/queue/enqueue";
import { computeSubredditTimeWindows } from "@/lib/subreddit/intel";

export async function processSubredditComputeTimeWindowsJob(
  job: Job<SubredditComputeTimeWindowsJobData>,
) {
  const subredditId = job.data.subredditId?.trim();
  if (!subredditId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const computed = await computeSubredditTimeWindows(subredditId);
  return {
    subredditId: computed.subredditId,
    slotCount: computed.slotCount,
    averageScore: computed.averageScore,
    status: "computed",
  };
}
