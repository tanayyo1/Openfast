import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { QuotaExceededError, assertWorkspaceQuota } from "@/lib/billing/quota";
import { getHealthGuardrailThresholds } from "@/lib/health/guardrails";
import { enqueuePublishJob } from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { evaluateCommunityEngagementThreshold } from "@/lib/reddit/communityEngagement";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { validatePostStructure } from "@/lib/content/postStructureValidator";

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  redditAccountId: z.string().optional(),
  status: z
    .enum([
      "SCHEDULED",
      "PENDING_APPROVAL",
      "PUBLISHING",
      "PUBLISHED",
      "FAILED_RETRYABLE",
      "FAILED_PERMANENT",
      "CANCELLED",
    ])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createScheduledPostSchema = z.object({
  draftId: z.string().min(1),
  redditAccountId: z.string().min(1),
  subredditId: z.string().min(1).optional(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1).max(100).default("UTC"),
  idempotencyKey: z.string().min(16).max(128).optional(),
});

const DEFAULT_COMMENT_FIRST_MIN_COMMENTS = 3;

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function isUniqueViolationFor(
  err: unknown,
  field: "idempotencyKey" | "draftId",
) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  const target = (err.meta?.target as string[] | undefined) ?? [];
  const fieldAliases: Record<typeof field, string[]> = {
    idempotencyKey: ["idempotencyKey", "idempotency_key"],
    draftId: ["draftId", "draft_id"],
  };
  return fieldAliases[field].some((alias) => target.includes(alias));
}

function defaultIdempotencyKey(input: {
  workspaceId: string;
  draftId: string;
  redditAccountId: string;
  subredditId: string;
  scheduledAtIso: string;
  timezone: string;
}) {
  const raw = [
    input.workspaceId,
    input.draftId,
    input.redditAccountId,
    input.subredditId,
    input.scheduledAtIso,
    input.timezone,
  ].join("|");
  return `sched_${createHash("sha256").update(raw).digest("hex").slice(0, 40)}`;
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
    projectId: searchParams.get("projectId") ?? undefined,
    redditAccountId: searchParams.get("redditAccountId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
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

  const { projectId, redditAccountId, status, from, to, limit } = parsed.data;
  const items = await prisma.scheduledPost.findMany({
    where: {
      workspaceId: session.workspaceId,
      ...(projectId ? { draft: { projectId } } : {}),
      ...(redditAccountId ? { redditAccountId } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            scheduledAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      draftId: true,
      redditAccountId: true,
      subredditId: true,
      scheduledAt: true,
      timezone: true,
      status: true,
      attempts: true,
      lastError: true,
      idempotencyKey: true,
      publishedAt: true,
      publishedItemId: true,
      createdAt: true,
      updatedAt: true,
      draft: {
        select: {
          id: true,
          projectId: true,
          type: true,
          title: true,
          status: true,
        },
      },
      redditAccount: {
        select: {
          id: true,
          redditUsername: true,
          safetyTier: true,
          isActive: true,
        },
      },
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
  });

  // Keep legacy key for compatibility with older clients/tests.
  return NextResponse.json({ items, scheduledPosts: items });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = createScheduledPostSchema.safeParse(json);
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

  const data = parsed.data;
  const healthThresholds = getHealthGuardrailThresholds();

  try {
    await assertWorkspaceQuota({
      workspaceId: session.workspaceId,
      resource: "scheduled_posts",
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: { resource: err.resource, used: err.used, limit: err.limit },
        },
        { status: 403 },
      );
    }
    throw err;
  }

  const draft = await prisma.draft.findFirst({
    where: { id: data.draftId, workspaceId: session.workspaceId },
    select: {
      id: true,
      status: true,
      subredditId: true,
      type: true,
      title: true,
      body: true,
    },
  });
  if (!draft) {
    return NextResponse.json(
      { error: "Draft not found", code: "DRAFT_NOT_FOUND" },
      { status: 404 },
    );
  }
  if (draft.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: "Only approved drafts can be scheduled",
        code: "INVALID_STATE",
      },
      { status: 409 },
    );
  }

  const structureResult = validatePostStructure(draft.title, draft.body);

  const redditAccount = await prisma.redditAccount.findFirst({
    where: {
      id: data.redditAccountId,
      workspaceId: session.workspaceId,
      isActive: true,
    },
    select: { id: true, safetyTier: true },
  });
  if (!redditAccount) {
    return NextResponse.json(
      { error: "Reddit account not found", code: "REDDIT_ACCOUNT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (redditAccount.safetyTier === "NEW" && draft.type === "POST") {
    const minCommentsRequired = parsePositiveEnvInt(
      "COMMENT_FIRST_MIN_COMMENTS",
      DEFAULT_COMMENT_FIRST_MIN_COMMENTS,
    );
    const publishedComments = await prisma.publishedItem.count({
      where: {
        workspaceId: session.workspaceId,
        redditAccountId: redditAccount.id,
        type: "COMMENT",
      },
    });
    if (publishedComments < minCommentsRequired) {
      return NextResponse.json(
        {
          error:
            "Comment-first mode active for NEW accounts. Publish comments first.",
          code: "COMMENT_FIRST_REQUIRED",
          details: {
            requiredComments: minCommentsRequired,
            publishedComments,
          },
        },
        { status: 409 },
      );
    }
  }

  if (draft.type === "POST") {
    const latestHealth = await prisma.accountHealthSnapshot.findFirst({
      where: {
        workspaceId: session.workspaceId,
        redditAccountId: redditAccount.id,
      },
      orderBy: { capturedAt: "desc" },
      select: { healthScore: true, capturedAt: true },
    });
    if (latestHealth && latestHealth.healthScore < healthThresholds.blockPublishing) {
      return NextResponse.json(
        {
          error:
            "Account health is below safe threshold. Scheduling posts is temporarily blocked.",
          code: "ACCOUNT_HEALTH_BLOCKED",
          details: {
            healthScore: latestHealth.healthScore,
            threshold: healthThresholds.blockPublishing,
            capturedAt: latestHealth.capturedAt.toISOString(),
          },
        },
        { status: 409 },
      );
    }
  }

  const subredditId = data.subredditId ?? draft.subredditId;
  if (!subredditId) {
    return NextResponse.json(
      {
        error: "Subreddit is required for scheduling",
        code: "SUBREDDIT_REQUIRED",
      },
      { status: 400 },
    );
  }
  const subreddit = await prisma.subredditCatalog.findUnique({
    where: { id: subredditId },
    select: { id: true },
  });
  if (!subreddit) {
    return NextResponse.json(
      { error: "Subreddit not found", code: "SUBREDDIT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (draft.type === "POST") {
    const communityThreshold = await evaluateCommunityEngagementThreshold(
      {
        workspaceId: session.workspaceId,
        redditAccountId: redditAccount.id,
        subredditId,
      },
      ({ workspaceId, redditAccountId, subredditId: thresholdSubredditId }) =>
        prisma.publishedItem.count({
          where: {
            workspaceId,
            redditAccountId,
            subredditId: thresholdSubredditId,
            type: "COMMENT",
          },
        }),
    );

    if (!communityThreshold.met) {
      return NextResponse.json(
        {
          error:
            "Community engagement threshold not met. Publish comments in this subreddit before posting.",
          code: "COMMUNITY_ENGAGEMENT_REQUIRED",
          details: {
            requiredComments: communityThreshold.requiredComments,
            publishedComments: communityThreshold.publishedComments,
            remainingComments: communityThreshold.remainingComments,
            subredditId,
          },
        },
        { status: 409 },
      );
    }
  }

  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return NextResponse.json(
      {
        error: "scheduledAt must be in the future",
        code: "INVALID_SCHEDULED_AT",
      },
      { status: 400 },
    );
  }

  const idempotencyKey =
    data.idempotencyKey ??
    defaultIdempotencyKey({
      workspaceId: session.workspaceId,
      draftId: data.draftId,
      redditAccountId: data.redditAccountId,
      subredditId,
      scheduledAtIso: scheduledAt.toISOString(),
      timezone: data.timezone,
    });

  let created: {
    id: string;
    draftId: string;
    redditAccountId: string;
    subredditId: string;
    scheduledAt: Date;
    timezone: string;
    status: string;
    attempts: number;
    lastError: string | null;
    idempotencyKey: string;
    publishedAt: Date | null;
    publishedItemId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null = null;

  try {
    created = await prisma.scheduledPost.create({
      data: {
        workspaceId: session.workspaceId,
        draftId: data.draftId,
        redditAccountId: data.redditAccountId,
        subredditId,
        scheduledAt,
        timezone: data.timezone,
        status: "SCHEDULED",
        idempotencyKey,
      },
      select: {
        id: true,
        draftId: true,
        redditAccountId: true,
        subredditId: true,
        scheduledAt: true,
        timezone: true,
        status: true,
        attempts: true,
        lastError: true,
        idempotencyKey: true,
        publishedAt: true,
        publishedItemId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (err) {
    if (isUniqueViolationFor(err, "idempotencyKey")) {
      const existing = await prisma.scheduledPost.findFirst({
        where: { workspaceId: session.workspaceId, idempotencyKey },
      });
      if (existing) {
        return NextResponse.json({
          scheduledPost: existing,
          idempotent: true,
        });
      }
    }
    if (isUniqueViolationFor(err, "draftId")) {
      return NextResponse.json(
        { error: "Draft is already scheduled", code: "ALREADY_SCHEDULED" },
        { status: 409 },
      );
    }
    throw err;
  }

  if (!created) {
    return NextResponse.json(
      { error: "Failed to schedule post", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
  try {
    const job = await enqueuePublishJob(
      { scheduledPostId: created.id },
      { delay: delayMs },
    );
    return NextResponse.json(
      {
        scheduledPost: created,
        queue: { id: job.id, delayMs },
        structure: {
          grade: structureResult.grade,
          score: structureResult.score,
          warnings: structureResult.warnings,
          rewriteSuggestions: structureResult.rewriteSuggestions,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    await prisma.scheduledPost.update({
      where: { id: created.id },
      data: {
        status: "FAILED_RETRYABLE",
        lastError:
          err instanceof Error ? `QUEUE_ENQUEUE_FAILED:${err.message}` : null,
      },
    });
    return NextResponse.json(
      { error: "Unable to enqueue publish job", code: "QUEUE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
