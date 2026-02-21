import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^(u\/)?[A-Za-z0-9_-]+$/, "Invalid username format"),
});

export async function POST(req: Request) {
  const userId = await requireSession()
    .then((session) => session.user.id)
    .catch(() => null);
  const rl = await enforcePublicToolRateLimit({
    req,
    tool: "shadowban-check",
    userId,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      { status: 429 },
    );
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

  const username = parsed.data.username.replace(/^u\//i, "");
  let profileOk = false;
  let profileStatus: number | null = null;
  try {
    const res = await fetch(
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      {
        headers: {
          "User-Agent": process.env.REDDIT_USER_AGENT ?? "ReditFast/0.1",
        },
      },
    );
    profileStatus = res.status;
    profileOk = res.ok;
  } catch {
    profileStatus = null;
    profileOk = false;
  }

  const internalSignals = await prisma.visibilityCheck.findMany({
    where: {
      redditAccount: { redditUsername: username },
    },
    orderBy: { checkedAt: "desc" },
    take: 10,
    select: { result: true, checkedAt: true },
  });

  const suspiciousCount = internalSignals.filter(
    (s) => s.result === "SUSPICIOUS",
  ).length;
  const internalRisk = internalSignals.length
    ? suspiciousCount / internalSignals.length
    : 0;

  const result = !profileOk || internalRisk > 0.5 ? "SUSPICIOUS" : "OK";

  return NextResponse.json({
    username,
    result,
    checks: {
      redditProfileReachable: profileOk,
      redditProfileStatus: profileStatus,
      internalSampleSize: internalSignals.length,
      internalSuspiciousRate: Number(internalRisk.toFixed(3)),
    },
    meta: {
      limit: rl.limit,
      remaining: rl.remaining,
      resetAfterSeconds: rl.resetAfterSeconds,
    },
  });
}
