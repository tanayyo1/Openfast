import type { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import {
  computeComplianceFromStructure,
  evaluateValueCheck,
} from "@/lib/content/complianceScoring";
import type { ContentGenerateJobData } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { assessRisk, buildDraftVariants } from "@/lib/content/generator";
import type { DraftVariant, RiskAssessment } from "@/lib/content/generator";
import { generateDraftVariantsWithOpenAI } from "@/lib/content/openaiVariants";
import { validatePostStructure } from "@/lib/content/postStructureValidator";
import { evaluateToneAlignment } from "@/lib/content/toneClassifier";
import { evaluateAntiPattern } from "@/lib/content/antiPattern";

type ScoredDraftVariant = DraftVariant &
  RiskAssessment & {
    complianceScore: number;
    structureGrade: string;
    valueScore: number;
    antiPatternPenalty: number;
    antiPatternFlags: string[];
    expectedTone: string;
    detectedTone: string;
  };

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
  const expectedTone =
    typeof tone === "string" && tone.trim().length > 0
      ? tone.trim()
      : (() => {
          if (
            task.roadmap.project.brandVoice &&
            typeof task.roadmap.project.brandVoice === "object"
          ) {
            const raw = (
              task.roadmap.project.brandVoice as Record<string, unknown>
            ).tone;
            if (typeof raw === "string" && raw.trim().length > 0) return raw;
          }
          return "neutral";
        })();

  const commonInput = {
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
  };

  const llmOutput = await generateDraftVariantsWithOpenAI({
    mode,
    projectName: commonInput.projectName,
    subredditName: commonInput.subredditName,
    subredditRulesText: commonInput.subredditRulesText,
    taskTitle: commonInput.taskTitle,
    taskInstructions: commonInput.taskInstructions,
    baseTitle: commonInput.baseTitle,
    baseBody: commonInput.baseBody,
    variantCount: commonInput.variantCount,
    preferredLength,
  }).catch(() => null);

  const { variants } =
    llmOutput ??
    buildDraftVariants(
      {
        ...commonInput,
      },
      preferredLength,
    );

  const scoredVariants = variants.map((variant) => {
    const baseRisk = assessRisk(
      variant.title,
      variant.body,
      rule?.rawRules ?? null,
    );
    const structure = validatePostStructure(variant.title, variant.body);
    const valueCheck = evaluateValueCheck({
      title: variant.title,
      body: variant.body,
    });
    const toneCheck = evaluateToneAlignment({
      expectedTone,
      title: variant.title,
      body: variant.body,
    });
    const antiPattern = evaluateAntiPattern({
      title: variant.title,
      body: variant.body,
    });
    const compliance = computeComplianceFromStructure({
      baseRiskScore: baseRisk.riskScore,
      structure: {
        grade: structure.grade,
        warnings: structure.warnings,
      },
      valuePenalty: valueCheck.penalty,
      antiPenalty: antiPattern.penalty,
    });
    const adjustedRiskScore = Math.max(
      0,
      Math.min(100, compliance.finalRiskScore + toneCheck.penalty),
    );
    const adjustedComplianceScore = Math.max(0, 100 - adjustedRiskScore);

    const mergedRiskReasons = [
      ...baseRisk.riskReasons,
      ...valueCheck.reasons,
      ...toneCheck.reasons,
      ...antiPattern.reasons,
      ...(structure.grade === "A"
        ? []
        : [`Structure grade ${structure.grade} increases compliance risk`]),
      ...structure.warnings
        .filter((warning) => warning.severity === "error")
        .slice(0, 2)
        .map((warning) => warning.message),
    ];
    const mergedFixes = [
      ...baseRisk.suggestedFixes,
      ...valueCheck.fixes,
      ...toneCheck.fixes,
      ...antiPattern.fixes,
      ...structure.rewriteSuggestions.map((item) => ({
        issue: item.issue,
        fix: item.suggestion,
      })),
    ];

    return {
      variant: {
        ...variant,
        riskScore: adjustedRiskScore,
        complianceScore: adjustedComplianceScore,
        riskReasons: mergedRiskReasons,
        suggestedFixes: mergedFixes,
        structureGrade: structure.grade,
        valueScore: valueCheck.valueScore,
        antiPatternPenalty: antiPattern.penalty,
        antiPatternFlags: antiPattern.flags,
        expectedTone: toneCheck.expectedTone,
        detectedTone: toneCheck.detectedTone,
      } as ScoredDraftVariant,
      structure,
      compliance,
      toneCheck,
      valueCheck,
      antiPattern,
    };
  });

  const primaryScored =
    scoredVariants.slice().sort((a, b) => {
      if (a.variant.riskScore !== b.variant.riskScore) {
        return a.variant.riskScore - b.variant.riskScore;
      }
      return b.variant.score - a.variant.score;
    })[0] ?? null;
  if (!primaryScored) {
    throw new Error("VARIANT_GENERATION_FAILED");
  }

  const primaryVariant = primaryScored.variant;
  const structureValidation = {
    grade: primaryScored.structure.grade,
    score: primaryScored.structure.score,
    warnings: primaryScored.structure.warnings,
    rewriteSuggestions: primaryScored.structure.rewriteSuggestions,
  } as unknown as Prisma.InputJsonValue;

  await prisma.draft.update({
    where: { id: draft.id },
    data: {
      title: primaryVariant.title,
      body: primaryVariant.body,
      variants: scoredVariants.map(
        (item) => item.variant,
      ) as unknown as Prisma.InputJsonValue,
      riskScore: primaryVariant.riskScore,
      riskReasons: primaryVariant.riskReasons,
      suggestedFixes:
        primaryVariant.suggestedFixes as unknown as Prisma.InputJsonValue,
      structureValidation,
      generationParams: {
        mode,
        variantCount: scoredVariants.length,
        tone: tone ?? null,
        length: preferredLength,
        compliance: {
          selectedRiskScore: primaryVariant.riskScore,
          selectedComplianceScore: primaryVariant.complianceScore,
          selectedStructureGrade: primaryVariant.structureGrade,
          selectedValueScore: primaryVariant.valueScore,
          structurePenalty: primaryScored.compliance.structurePenalty,
          valuePenalty: primaryScored.compliance.valuePenalty,
          antiPatternPenalty: primaryScored.compliance.antiPenalty,
          tonePenalty: primaryScored.toneCheck.penalty,
          selectedAntiPatternFlags: primaryVariant.antiPatternFlags,
          selectedExpectedTone: primaryVariant.expectedTone ?? null,
          selectedDetectedTone: primaryVariant.detectedTone ?? null,
        },
        generatedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
    },
    select: { id: true },
  });

  return {
    draftId: draft.id,
    taskId,
    variantCount: scoredVariants.length,
    riskScore: primaryVariant.riskScore,
    status: "generated" as const,
  };
}
