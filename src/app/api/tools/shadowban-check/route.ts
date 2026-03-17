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
    .max(20)
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
  const usernameLookup = username.toLowerCase();
  let profileOk = false;
  let profileStatus: number | null = null;
  let profileTimedOut = false;
  const userAgent =
    process.env.REDDIT_USER_AGENT ??
    "Mozilla/5.0 (compatible; Openfast/0.1; +https://openfast-nine.vercel.app)";

  const endpoints = [
    `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
    `https://old.reddit.com/user/${encodeURIComponent(username)}/about.json`,
  ];

  // Fetch both endpoints in parallel — use first successful response
  const results = await Promise.allSettled(
    endpoints.map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          headers: { "User-Agent": userAgent },
        });
        return { status: res.status, ok: res.ok, timedOut: false };
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "AbortError";
        return { status: null, ok: false, timedOut };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      profileOk = true;
      profileStatus = r.value.status;
      break;
    }
  }
  if (!profileOk) {
    // No successful response — use the best signal from what we got
    for (const r of results) {
      if (r.status === "fulfilled") {
        profileStatus = r.value.status ?? profileStatus;
        profileTimedOut = profileTimedOut || r.value.timedOut;
      }
    }
  }

  const internalSignals = await prisma.visibilityCheck.findMany({
    where: {
      redditAccount: {
        redditUsername: {
          equals: usernameLookup,
          mode: "insensitive",
        },
      },
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
      redditProfileTimedOut: profileTimedOut,
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
