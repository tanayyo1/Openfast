import { z } from "zod";
import type { RedditAdCampaignStatus } from "@prisma/client";

const campaignCursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
});

export type RedditAdCampaignCursor = z.infer<typeof campaignCursorSchema>;

export function encodeCampaignCursor(cursor: RedditAdCampaignCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCampaignCursor(raw: string) {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as unknown;
    const res = campaignCursorSchema.safeParse(parsed);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}

export function normalizeSubredditName(raw: string) {
  const trimmed = raw.trim().toLowerCase().replace(/^r\//, "");
  if (!/^[a-z0-9_]{3,21}$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeSubredditTargets(raw: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of raw) {
    const parsed = normalizeSubredditName(value);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    normalized.push(parsed);
  }

  return normalized;
}

export function normalizeCountryTargets(raw: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of raw) {
    const parsed = value.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(parsed) || seen.has(parsed)) continue;
    seen.add(parsed);
    normalized.push(parsed);
  }

  return normalized;
}

export function validateBudgetWindow(opts: {
  dailyBudgetCents: number;
  lifetimeBudgetCents: number | null;
}) {
  if (opts.dailyBudgetCents < 500) {
    return {
      ok: false as const,
      error: "dailyBudgetCents must be at least 500",
    };
  }

  if (
    opts.lifetimeBudgetCents != null &&
    opts.lifetimeBudgetCents < opts.dailyBudgetCents
  ) {
    return {
      ok: false as const,
      error: "lifetimeBudgetCents must be greater than or equal to dailyBudgetCents",
    };
  }

  return { ok: true as const };
}

export function validateScheduleWindow(opts: {
  startAt: Date | null;
  endAt: Date | null;
}) {
  if ((opts.startAt && !opts.endAt) || (!opts.startAt && opts.endAt)) {
    return {
      ok: false as const,
      error: "Both startAt and endAt must be provided together",
    };
  }

  if (opts.startAt && opts.endAt && opts.startAt >= opts.endAt) {
    return {
      ok: false as const,
      error: "startAt must be earlier than endAt",
    };
  }

  return { ok: true as const };
}

const allowedTransitions: Record<
  RedditAdCampaignStatus,
  ReadonlyArray<RedditAdCampaignStatus>
> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["PAUSED", "COMPLETED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionCampaignStatus(
  from: RedditAdCampaignStatus,
  to: RedditAdCampaignStatus,
) {
  if (from === to) return true;
  return allowedTransitions[from].includes(to);
}
