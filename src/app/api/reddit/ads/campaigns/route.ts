import { NextResponse } from "next/server";
import { Prisma, RedditAdCampaignStatus, RedditAdObjective } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import {
  decodeCampaignCursor,
  encodeCampaignCursor,
  normalizeCountryTargets,
  normalizeSubredditTargets,
  validateBudgetWindow,
  validateScheduleWindow,
} from "@/lib/redditAds/campaigns";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  projectId: z.string().optional(),
  redditAccountId: z.string().optional(),
  status: z.nativeEnum(RedditAdCampaignStatus).optional(),
  objective: z.nativeEnum(RedditAdObjective).optional(),
});

const createCampaignSchema = z.object({
  projectId: z.string().min(1),
  redditAccountId: z.string().min(1).optional().nullable(),
  name: z.string().trim().min(3).max(120),
  objective: z.nativeEnum(RedditAdObjective).default(RedditAdObjective.TRAFFIC),
  dailyBudgetCents: z.coerce.number().int().min(500).max(5_000_000),
  lifetimeBudgetCents: z.coerce
    .number()
    .int()
    .min(500)
    .max(100_000_000)
    .optional()
    .nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  targetSubreddits: z.array(z.string().min(1)).min(1).max(20),
  targetCountries: z.array(z.string().min(2).max(2)).max(20).optional().default([]),
  interests: z.unknown().optional().nullable(),
  headline: z.string().trim().max(300).optional().nullable(),
  body: z.string().trim().max(3000).optional().nullable(),
  destinationUrl: z.string().url().max(2048).optional().nullable(),
  ctaText: z.string().trim().max(60).optional().nullable(),
  status: z.nativeEnum(RedditAdCampaignStatus).optional(),
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

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  const { searchParams } = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    redditAccountId: searchParams.get("redditAccountId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    objective: searchParams.get("objective") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { cursor, limit, projectId, redditAccountId, status, objective } =
    parsed.data;
  const decodedCursor = cursor ? decodeCampaignCursor(cursor) : null;
  if (cursor && !decodedCursor) {
    return NextResponse.json(
      { error: "Invalid cursor", code: "INVALID_CURSOR" },
      { status: 400 },
    );
  }

  const items = await prisma.redditAdCampaign.findMany({
    where: {
      workspaceId: session.workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(redditAccountId ? { redditAccountId } : {}),
      ...(status ? { status } : {}),
      ...(objective ? { objective } : {}),
      ...(decodedCursor
        ? {
            OR: [
              { createdAt: { lt: new Date(decodedCursor.createdAt) } },
              {
                createdAt: new Date(decodedCursor.createdAt),
                id: { lt: decodedCursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: campaignSelect,
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore
    ? encodeCampaignCursor({
        createdAt: page[page.length - 1].createdAt.toISOString(),
        id: page[page.length - 1].id,
      })
    : null;

  return NextResponse.json({ items: page, nextCursor });
}

export async function POST(req: Request) {
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

  const parsed = createCampaignSchema.safeParse(rawJson);
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

  const input = parsed.data;
  if (input.status && input.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Campaign must be created in DRAFT status", code: "INVALID_STATUS" },
      { status: 400 },
    );
  }

  const budgetValidation = validateBudgetWindow({
    dailyBudgetCents: input.dailyBudgetCents,
    lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
  });
  if (!budgetValidation.ok) {
    return NextResponse.json(
      { error: budgetValidation.error, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const startAt = input.startAt ? new Date(input.startAt) : null;
  const endAt = input.endAt ? new Date(input.endAt) : null;
  const scheduleValidation = validateScheduleWindow({ startAt, endAt });
  if (!scheduleValidation.ok) {
    return NextResponse.json(
      { error: scheduleValidation.error, code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const targetSubreddits = normalizeSubredditTargets(input.targetSubreddits);
  if (targetSubreddits.length === 0) {
    return NextResponse.json(
      {
        error: "At least one valid target subreddit is required",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const targetCountries = normalizeCountryTargets(input.targetCountries);
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, workspaceId: session.workspaceId },
    select: { id: true, status: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }
  if (project.status === "ARCHIVED") {
    return NextResponse.json(
      {
        error: "Cannot create campaigns for archived projects",
        code: "INVALID_PROJECT_STATE",
      },
      { status: 409 },
    );
  }

  if (input.redditAccountId) {
    const account = await prisma.redditAccount.findFirst({
      where: {
        id: input.redditAccountId,
        workspaceId: session.workspaceId,
        isActive: true,
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

  const created = await prisma.redditAdCampaign.create({
    data: {
      workspaceId: session.workspaceId,
      projectId: input.projectId,
      redditAccountId: input.redditAccountId ?? null,
      name: input.name,
      objective: input.objective,
      status: "DRAFT",
      dailyBudgetCents: input.dailyBudgetCents,
      lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
      startAt,
      endAt,
      targetSubreddits,
      targetCountries,
      interests:
        input.interests == null
          ? Prisma.DbNull
          : (input.interests as Prisma.InputJsonValue),
      headline: input.headline ?? null,
      body: input.body ?? null,
      destinationUrl: input.destinationUrl ?? null,
      ctaText: input.ctaText ?? null,
    },
    select: campaignSelect,
  });

  return NextResponse.json({ campaign: created }, { status: 201 });
}
