import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";
import { fetchRedditJson } from "@/lib/reddit/proxyFetch";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^(u\/)?[A-Za-z0-9_-]+$/, "Invalid username format"),
});

type ProfileData = {
  name?: string;
  is_suspended?: boolean;
  total_karma?: number;
  link_karma?: number;
  comment_karma?: number;
  created_utc?: number;
  has_verified_email?: boolean;
};

function accountAgeDays(createdUtc: number | undefined): number | null {
  if (!createdUtc || !Number.isFinite(createdUtc)) return null;
  return Math.max(0, Math.floor((Date.now() - createdUtc * 1000) / 86_400_000));
}

function assessResult(s: {
  profileOk: boolean;
  profileStatus: number | null;
  isSuspended: boolean;
  hasActivity: boolean;
  negativeKarma: boolean;
  internalRisk: number;
}): { result: string; reason: string } {
  if (!s.profileOk && s.profileStatus === 404)
    return { result: "NOT_FOUND", reason: "Account does not exist on Reddit." };
  if (!s.profileOk)
    return {
      result: "UNREACHABLE",
      reason: "Could not reach Reddit to check this account.",
    };
  if (s.isSuspended)
    return {
      result: "SUSPENDED",
      reason: "This account has been suspended by Reddit.",
    };
  if (!s.hasActivity)
    return {
      result: "SHADOWBANNED",
      reason:
        "Profile exists but has no visible posts or comments. This is a strong indicator of a shadowban.",
    };
  if (s.negativeKarma)
    return {
      result: "AT_RISK",
      reason:
        "Account has negative karma which increases risk of reduced visibility and automatic filtering.",
    };
  if (s.internalRisk > 0.5)
    return {
      result: "AT_RISK",
      reason:
        "Internal signals indicate elevated visibility risk from past checks.",
    };
  return {
    result: "CLEAR",
    reason: "No shadowban signals detected. Account appears healthy.",
  };
}

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
  let profileData: ProfileData | null = null;
  let activityCount = 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const [profileRes, activityRes] = await Promise.all([
      fetchRedditJson(`/user/${encodeURIComponent(username)}/about.json`, {
        signal: controller.signal,
      }),
      fetchRedditJson(`/user/${encodeURIComponent(username)}/.json`, {
        signal: controller.signal,
      }).catch(() => null),
    ]);

    profileStatus = profileRes.status;
    profileOk = profileRes.ok;

    if (profileOk) {
      const body = (await profileRes.json()) as { data?: ProfileData };
      profileData = body?.data ?? null;
    }

    if (activityRes?.ok) {
      const body = (await activityRes.json()) as {
        data?: { children?: unknown[] };
      };
      activityCount = body?.data?.children?.length ?? 0;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      profileTimedOut = true;
    }
    profileStatus = null;
    profileOk = false;
  } finally {
    clearTimeout(timer);
  }

  const internalSignals = await prisma.visibilityCheck.findMany({
    where: {
      redditAccount: {
        redditUsername: { equals: usernameLookup, mode: "insensitive" },
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

  const totalKarma = profileData?.total_karma ?? 0;
  const isSuspended = Boolean(profileData?.is_suspended);

  const { result, reason } = assessResult({
    profileOk,
    profileStatus,
    isSuspended,
    hasActivity: activityCount > 0,
    negativeKarma: profileOk && totalKarma < 0,
    internalRisk,
  });

  return NextResponse.json({
    username,
    result,
    reason,
    profile: profileData
      ? {
          karma: totalKarma,
          commentKarma: profileData.comment_karma ?? 0,
          accountAgeDays: accountAgeDays(profileData.created_utc),
          hasVerifiedEmail: Boolean(profileData.has_verified_email),
          isSuspended,
          recentActivityCount: activityCount,
        }
      : null,
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
