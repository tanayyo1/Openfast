import type { Job } from "bullmq";
import type { RecommendationsGenerateJobData } from "@/lib/queue/enqueue";
import { generateProjectRecommendations } from "@/lib/recommendations/generate";

export async function processRecommendationsGenerateJob(
  job: Job<RecommendationsGenerateJobData>,
) {
  const { workspaceId, projectId } = job.data;
  if (!workspaceId || !projectId) throw new Error("INVALID_JOB_DATA");

  const generated = await generateProjectRecommendations({
    workspaceId,
    projectId,
  });
  return {
    projectId,
    recommendations: generated.recommendations.length,
    status: "generated" as const,
  };
}
