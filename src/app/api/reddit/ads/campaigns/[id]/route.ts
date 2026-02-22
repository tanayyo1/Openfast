import { NextResponse } from "next/server";
import {
  Prisma,
  RedditAdCampaignStatus,
  RedditAdObjective,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  enqueueRedditAdsSyncJob,
  type RedditAdsSyncAction,
} from "@/lib/queue/enqueue";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import {
  canTransitionCampaignStatus,
  normalizeCountryTargets,
  normalizeSubredditTargets,
  validateBudgetWindow,
  validateScheduleWindow,
} from "@/lib/redditAds/campaigns";

const patchCampaignSchema = z.object({
  redditAccountId: z.union([z.string().min(1), z.null()]).optional(),
  name: z.string().trim().min(3).max(120).optional(),
  objective: z.nativeEnum(RedditAdObjective).optional(),
  status: z.nativeEnum(RedditAdCampaignStatus).optional(),
  dailyBudgetCents: z.coerce.number().int().min(500).max(5_000_000).optional(),
  lifetimeBudgetCents: z.coerce
    .number()
    .int()
    .min(500)
    .max(100_000_000)
    .nullable()
    .optional(),
  startAt: z.union([z.string().datetime(), z.null()]).optional(),
  endAt: z.union([z.string().datetime(), z.null()]).optional(),
  targetSubreddits: z.array(z.string().min(1)).min(1).max(20).optional(),
  targetCountries: z.array(z.string().min(2).max(2)).max(20).optional(),
  interests: z.unknown().nullable().optional(),
  headline: z.union([z.string().trim().max(300), z.null()]).optional(),
  body: z.union([z.string().trim().max(3000), z.null()]).optional(),
  destinationUrl: z.union([z.string().url().max(2048), z.null()]).optional(),
  ctaText: z.union([z.string().trim().max(60), z.null()]).optional(),
});

const campaignSelect = {
  id: true,
  workspaceId: true,
  projectId: true,
  redditAccountId: true,
  name: true,
  objective: true,
  status: true,
  dailyBudgetCents: true,
  lifetimeBudgetCents: true,
  startAt: true,
  endAt: true,
  targetSubreddits: true,
  targetCountries: true,
  interests: true,
  headline: true,
  body: true,
  destinationUrl: true,
  ctaText: true,
  externalCampaignId: true,
  syncError: true,
  launchedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  redditAccount: {
    select: {
      id: true,
      redditUsername: true,
      isActive: true,
    },
  },
} satisfies Prisma.RedditAdCampaignSelect;

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function sameDate(a: Date | null, b: Date | null) {
  return (a?.toISOString() ?? null) === (b?.toISOString() ?? null);
}

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameJsonValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function syncActionForStatus(
  status: RedditAdCampaignStatus,
): RedditAdsSyncAction | null {
  if (status === "ACTIVE") return "UPSERT";
  if (status === "PAUSED") return "PAUSE";
  if (status === "COMPLETED") return "COMPLETE";
  if (status === "ARCHIVED") return "ARCHIVE";
  return null;
}

async function findCampaignOr404(workspaceId: string, id: string) {
  const campaign = await prisma.redditAdCampaign.findFirst({
    where: { id, workspaceId },
    select: campaignSelect,
  });
  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found", code: "CAMPAIGN_NOT_FOUND" },
      { status: 404 },
    );
  }
  return campaign;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const campaign = await findCampaignOr404(session.workspaceId, ctx.params.id);
  if (campaign instanceof NextResponse) return campaign;
  return NextResponse.json({ campaign });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  let rawJson: unknown;
  try {
    rawJson = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = patchCampaignSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update", code: "NO_UPDATES" },
      { status: 400 },
    );
  }

  const campaign = await findCampaignOr404(session.workspaceId, ctx.params.id);
  if (campaign instanceof NextResponse) return campaign;
  if (campaign.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Archived campaigns cannot be modified", code: "INVALID_STATE" },
      { status: 409 },
    );
  }

  const nextStatus = parsed.data.status ?? campaign.status;
  if (!canTransitionCampaignStatus(campaign.status, nextStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status transition from ${campaign.status} to ${nextStatus}`,
        code: "INVALID_STATUS_TRANSITION",
      },
      { status: 409 },
    );
  }

  const nextDailyBudget =
    parsed.data.dailyBudgetCents ?? campaign.dailyBudgetCents;
  const nextLifetimeBudget =
    parsed.data.lifetimeBudgetCents !== undefined
      ? parsed.data.lifetimeBudgetCents
      : campaign.lifetimeBudgetCents;
  const budgetValidation = validateBudgetWindow({
    dailyBudgetCents: nextDailyBudget,
    lifetimeBudgetCents: nextLifetimeBudget,
  });
  if (!budgetValidation.ok) {
    return NextResponse.json(
      { error: budgetValidation.error, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const nextStartAt =
    parsed.data.startAt !== undefined
      ? parsed.data.startAt
        ? new Date(parsed.data.startAt)
        : null
      : campaign.startAt;
  const nextEndAt =
    parsed.data.endAt !== undefined
      ? parsed.data.endAt
        ? new Date(parsed.data.endAt)
        : null
      : campaign.endAt;
  const scheduleValidation = validateScheduleWindow({
    startAt: nextStartAt,
    endAt: nextEndAt,
  });
  if (!scheduleValidation.ok) {
    return NextResponse.json(
      { error: scheduleValidation.error, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const nextTargetSubreddits =
    parsed.data.targetSubreddits !== undefined
      ? normalizeSubredditTargets(parsed.data.targetSubreddits)
      : campaign.targetSubreddits;
  if (nextTargetSubreddits.length === 0) {
    return NextResponse.json(
      {
        error: "At least one valid target subreddit is required",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const nextTargetCountries =
    parsed.data.targetCountries !== undefined
      ? normalizeCountryTargets(parsed.data.targetCountries)
      : campaign.targetCountries;
  const nextRedditAccountId =
    parsed.data.redditAccountId !== undefined
      ? parsed.data.redditAccountId
      : campaign.redditAccountId;
  const isActivating = nextStatus === "ACTIVE";
  const accountMustBeActive =
    isActivating || parsed.data.redditAccountId !== undefined;

  if (isActivating && campaign.project.status === "ARCHIVED") {
    return NextResponse.json(
      {
        error: "Cannot activate campaigns for archived projects",
        code: "INVALID_PROJECT_STATE",
      },
      { status: 409 },
    );
  }

  if (nextRedditAccountId) {
    const account = await prisma.redditAccount.findFirst({
      where: {
        id: nextRedditAccountId,
        workspaceId: session.workspaceId,
        ...(accountMustBeActive ? { isActive: true } : {}),
      },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json(
        {
          error: "Active Reddit account not found in workspace",
          code: "REDDIT_ACCOUNT_NOT_FOUND",
        },
        { status: 404 },
      );
    }
  }

  const nextHeadline =
    parsed.data.headline !== undefined
      ? parsed.data.headline
      : campaign.headline;
  const nextBody =
    parsed.data.body !== undefined ? parsed.data.body : campaign.body;
  const nextDestinationUrl =
    parsed.data.destinationUrl !== undefined
      ? parsed.data.destinationUrl
      : campaign.destinationUrl;
  const nextInterests =
    parsed.data.interests !== undefined
      ? parsed.data.interests == null
        ? Prisma.DbNull
        : (parsed.data.interests as Prisma.InputJsonValue)
      : campaign.interests == null
        ? Prisma.DbNull
        : (campaign.interests as Prisma.InputJsonValue);

  const interestsForCompare =
    parsed.data.interests !== undefined
      ? parsed.data.interests
      : campaign.interests;

  if (isActivating) {
    if (!nextRedditAccountId) {
      return NextResponse.json(
        {
          error: "Active campaigns require a connected Reddit account",
          code: "REDDIT_ACCOUNT_REQUIRED",
        },
        { status: 409 },
      );
    }
    if (!nextHeadline || !nextBody || !nextDestinationUrl) {
      return NextResponse.json(
        {
          error:
            "Active campaigns require headline, body, and destinationUrl creative fields",
          code: "CREATIVE_REQUIRED",
        },
        { status: 409 },
      );
    }
  }

  const statusChanged = nextStatus !== campaign.status;
  const configChanged =
    (parsed.data.redditAccountId !== undefined &&
      nextRedditAccountId !== campaign.redditAccountId) ||
    (parsed.data.name !== undefined && parsed.data.name !== campaign.name) ||
    (parsed.data.objective !== undefined &&
      parsed.data.objective !== campaign.objective) ||
    (parsed.data.dailyBudgetCents !== undefined &&
      nextDailyBudget !== campaign.dailyBudgetCents) ||
    (parsed.data.lifetimeBudgetCents !== undefined &&
      nextLifetimeBudget !== campaign.lifetimeBudgetCents) ||
    (parsed.data.startAt !== undefined &&
      !sameDate(nextStartAt, campaign.startAt)) ||
    (parsed.data.endAt !== undefined && !sameDate(nextEndAt, campaign.endAt)) ||
    (parsed.data.targetSubreddits !== undefined &&
      !sameStringArray(nextTargetSubreddits, campaign.targetSubreddits)) ||
    (parsed.data.targetCountries !== undefined &&
      !sameStringArray(nextTargetCountries, campaign.targetCountries)) ||
    (parsed.data.interests !== undefined &&
      !sameJsonValue(interestsForCompare, campaign.interests)) ||
    (parsed.data.headline !== undefined &&
      nextHeadline !== campaign.headline) ||
    (parsed.data.body !== undefined && nextBody !== campaign.body) ||
    (parsed.data.destinationUrl !== undefined &&
      nextDestinationUrl !== campaign.destinationUrl) ||
    (parsed.data.ctaText !== undefined &&
      parsed.data.ctaText !== campaign.ctaText);

  const syncAction = syncActionForStatus(nextStatus);
  const shouldQueueSync =
    syncAction !== null && (statusChanged || configChanged);
  const syncTrigger = statusChanged ? "STATUS_CHANGE" : "CONFIG_CHANGE";

  let updated = await prisma.redditAdCampaign.update({
    where: { id: campaign.id },
    data: {
      redditAccountId: nextRedditAccountId,
      name: parsed.data.name ?? campaign.name,
      objective: parsed.data.objective ?? campaign.objective,
      status: nextStatus,
      dailyBudgetCents: nextDailyBudget,
      lifetimeBudgetCents: nextLifetimeBudget,
      startAt: nextStartAt,
      endAt: nextEndAt,
      targetSubreddits: nextTargetSubreddits,
      targetCountries: nextTargetCountries,
      interests: nextInterests,
      headline: nextHeadline,
      body: nextBody,
      destinationUrl: nextDestinationUrl,
      ctaText:
        parsed.data.ctaText !== undefined
          ? parsed.data.ctaText
          : campaign.ctaText,
      syncError: shouldQueueSync ? null : campaign.syncError,
      launchedAt:
        nextStatus === "ACTIVE" && campaign.launchedAt == null
          ? new Date()
          : campaign.launchedAt,
      archivedAt: nextStatus === "ARCHIVED" ? new Date() : campaign.archivedAt,
    },
    select: campaignSelect,
  });

  if (shouldQueueSync && syncAction) {
    try {
      await enqueueRedditAdsSyncJob({
        workspaceId: session.workspaceId,
        campaignId: updated.id,
        status: updated.status,
        action: syncAction,
        trigger: syncTrigger,
        version: updated.updatedAt.toISOString(),
      });
    } catch {
      updated = await prisma.redditAdCampaign.update({
        where: { id: updated.id },
        data: { syncError: "SYNC_QUEUE_ENQUEUE_FAILED" },
        select: campaignSelect,
      });
    }
  }

  return NextResponse.json({ campaign: updated });
}
