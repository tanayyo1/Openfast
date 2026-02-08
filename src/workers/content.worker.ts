import type { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import type { ContentGenerateJobData } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { assessRisk, buildDraftVariants } from "@/lib/content/generator";

export async function processContentGenerateJob(
  job: Job<ContentGenerateJobData>,
) {
  const { workspaceId, taskId, draftId, mode, variantCount, tone, length } =
    job.data;

  if (!workspaceId || !taskId || !draftId) {
    throw new Error("INVALID_JOB_DATA");
  }

  const task = await prisma.roadmapTask.findFirst({
    where: { id: taskId, workspaceId },
    include: {
      roadmap: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              brandVoice: true,
            },
          },
        },
      },
      subreddit: {
        select: { id: true, name: true },
      },
    },
  });

  if (!task) {
    throw new Error("TASK_NOT_FOUND");
  }

  if (task.roadmap.project.status === "ARCHIVED") {
    throw new Error("INVALID_PROJECT_STATE");
  }

  const draft = await prisma.draft.findFirst({
    where: { id: draftId, workspaceId, taskId },
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      status: true,
      subredditId: true,
    },
  });
  if (!draft) {
    throw new Error("DRAFT_NOT_FOUND");
  }

  if (draft.status === "APPROVED" || draft.status === "ARCHIVED") {
    throw new Error("INVALID_DRAFT_STATE");
  }

  const rule = draft.subredditId
    ? await prisma.subredditRule.findFirst({
        where: { subredditId: draft.subredditId },
        orderBy: { fetchedAt: "desc" },
        select: { rawRules: true },
      })
    : null;

  const preferredLength =
    length === "short" || length === "long" ? length : "medium";
  const { variants, primary } = buildDraftVariants(
    {
      mode,
      baseTitle: draft.title,
      baseBody: draft.body,
      taskTitle: task.title,
      taskInstructions: task.instructions,
      projectName: task.roadmap.project.name,
      brandVoice: task.roadmap.project.brandVoice,
      subredditName: task.subreddit?.name ?? null,
      subredditRulesText: rule?.rawRules ?? null,
      variantCount: Math.max(3, variantCount),
    },
    preferredLength,
  );

  const risk = assessRisk(primary.title, primary.body, rule?.rawRules ?? null);

  await prisma.draft.update({
    where: { id: draft.id },
    data: {
      title: primary.title,
      body: primary.body,
      variants: variants as unknown as Prisma.InputJsonValue,
      riskScore: risk.riskScore,
      riskReasons: risk.riskReasons,
      suggestedFixes: risk.suggestedFixes as unknown as Prisma.InputJsonValue,
      generationParams: {
        mode,
        variantCount: variants.length,
        tone: tone ?? null,
        length: preferredLength,
        generatedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
    },
    select: { id: true },
  });

  return {
    draftId: draft.id,
    taskId,
    variantCount: variants.length,
    riskScore: risk.riskScore,
    status: "generated" as const,
  };
}
