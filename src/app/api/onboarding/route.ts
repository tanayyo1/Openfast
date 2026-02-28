import { NextResponse } from "next/server";
import { z } from "zod";
import { OnboardingStep } from "@prisma/client";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import {
  getOrCreateOnboardingProgress,
  updateOnboardingStep,
} from "@/lib/onboarding-db";

export async function GET() {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const workspaceId = session.workspaceId;

  const progress = await getOrCreateOnboardingProgress(workspaceId);

  const stepToId: Record<OnboardingStep, string> = {
    [OnboardingStep.PROJECT]: "project",
    [OnboardingStep.REDDIT]: "reddit",
    [OnboardingStep.ROADMAP]: "roadmap",
  };

  const response = {
    currentStep: stepToId[progress.currentStep] || "project",
    completedSteps: progress.completedSteps as string[],
    completed: progress.completedAt !== null,
    projectId: progress.projectId,
    startedAt: progress.startedAt?.toISOString() ?? null,
    completedAt: progress.completedAt?.toISOString() ?? null,
  };

  return NextResponse.json(response);
}

const updateStepSchema = z.object({
  step: z.enum(["project", "reddit", "roadmap"]),
});

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const workspaceId = session.workspaceId;

  const body = await req.json();
  const parseResult = updateStepSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const { step } = parseResult.data;

  const updated = await updateOnboardingStep(workspaceId, step);

  const stepToId: Record<OnboardingStep, string> = {
    [OnboardingStep.PROJECT]: "project",
    [OnboardingStep.REDDIT]: "reddit",
    [OnboardingStep.ROADMAP]: "roadmap",
  };

  const response = {
    currentStep: stepToId[updated.currentStep] || "project",
    completedSteps: updated.completedSteps as string[],
    completed: updated.completedAt !== null,
  };

  return NextResponse.json(response);
}
