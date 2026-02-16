import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueRiskVisibilityCheckJob } from "@/lib/queue/enqueue";
import { normalizeRedditPermalink } from "@/lib/reddit/permalink";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const schema = z.object({
  publishedItemId: z.string().min(1).optional(),
  permalink: z.string().min(1).optional(),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
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
    json = {};
  }
  const parsed = schema.safeParse(json);
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

  const redditAccountId = ctx.params.id;
  const account = await prisma.redditAccount.findFirst({
    where: { id: redditAccountId, workspaceId: session.workspaceId },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Reddit account not found", code: "REDDIT_ACCOUNT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!parsed.data.publishedItemId && !parsed.data.permalink) {
    return NextResponse.json(
      {
        error: "publishedItemId or permalink is required",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const job = await enqueueRiskVisibilityCheckJob({
    workspaceId: session.workspaceId,
    redditAccountId,
    publishedItemId: parsed.data.publishedItemId ?? null,
    permalink: parsed.data.permalink ?? null,
  }).catch(() => null);

  // Also perform an inline visibility check for immediate response.
  const permalink =
    parsed.data.permalink ??
    (parsed.data.publishedItemId
      ? (
          await prisma.publishedItem.findFirst({
            where: {
              id: parsed.data.publishedItemId,
              workspaceId: session.workspaceId,
              redditAccountId,
            },
            select: { permalink: true },
          })
        )?.permalink
      : null);

  if (!permalink) {
    return NextResponse.json(
      { error: "Permalink not found", code: "PERMALINK_NOT_FOUND" },
      { status: 404 },
    );
  }

  const fullPermalink = normalizeRedditPermalink(permalink);
  if (!fullPermalink) {
    return NextResponse.json(
      {
        error: "Permalink must be a valid reddit.com URL or relative Reddit path",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  let visibleLoggedOut: boolean | null = null;
  let statusCode: number | null = null;
  try {
    const res = await fetch(`${fullPermalink}.json`, {
      headers: {
        "User-Agent": process.env.REDDIT_USER_AGENT ?? "ReditFast/0.1",
      },
    });
    statusCode = res.status;
    visibleLoggedOut = res.ok;
  } catch {
    visibleLoggedOut = null;
  }

  const result =
    visibleLoggedOut === true
      ? "OK"
      : visibleLoggedOut === false
        ? "SUSPICIOUS"
        : "UNKNOWN";

  const check = await prisma.visibilityCheck.create({
    data: {
      workspaceId: session.workspaceId,
      redditAccountId,
      publishedItemId: parsed.data.publishedItemId ?? null,
      permalink: fullPermalink,
      visibleLoggedOut,
      result,
      signalsJson: { httpStatus: statusCode },
    },
    select: {
      id: true,
      result: true,
      checkedAt: true,
      permalink: true,
      visibleLoggedOut: true,
      signalsJson: true,
    },
  });

  return NextResponse.json({
    check,
    queue: job ? { id: job.id } : null,
  });
}
