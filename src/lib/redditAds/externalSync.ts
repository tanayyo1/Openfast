import { createHash } from "crypto";
import type { RedditAdObjective, RedditAdCampaignStatus } from "@prisma/client";
import type { RedditAdsSyncAction } from "@/lib/queue/enqueue";

export type ExternalSyncCampaign = {
  id: string;
  workspaceId: string;
  redditAccountId: string | null;
  name: string;
  objective: RedditAdObjective;
  status: RedditAdCampaignStatus;
  dailyBudgetCents: number;
  lifetimeBudgetCents: number | null;
  startAt: Date | null;
  endAt: Date | null;
  targetSubreddits: string[];
  targetCountries: string[];
  interests: unknown;
  headline: string | null;
  body: string | null;
  destinationUrl: string | null;
  ctaText: string | null;
  externalCampaignId: string | null;
};

export type SyncRedditAdCampaignInput = {
  campaign: ExternalSyncCampaign;
  action: RedditAdsSyncAction;
  version: string;
};

export type SyncRedditAdCampaignResult = {
  externalCampaignId: string | null;
  remoteStatus: string;
};

function parseTimeoutMs() {
  const raw = Number(process.env.REDDIT_ADS_SYNC_TIMEOUT_MS ?? "10000");
  if (!Number.isFinite(raw) || raw <= 0) return 10_000;
  return Math.floor(raw);
}

function getSyncMode() {
  const raw = (process.env.REDDIT_ADS_SYNC_MODE ?? "mock").trim().toLowerCase();
  return raw === "webhook" ? "webhook" : "mock";
}

function buildMockExternalCampaignId(input: {
  workspaceId: string;
  campaignId: string;
}) {
  const digest = createHash("sha256")
    .update(`${input.workspaceId}:${input.campaignId}`)
    .digest("hex");
  return `mock_${digest.slice(0, 20)}`;
}

async function syncWithWebhook(
  input: SyncRedditAdCampaignInput,
): Promise<SyncRedditAdCampaignResult> {
  const endpoint = process.env.REDDIT_ADS_SYNC_ENDPOINT;
  if (!endpoint) {
    throw new Error("EXTERNAL_SYNC_CONFIG_MISSING_ENDPOINT");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.REDDIT_ADS_SYNC_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseTimeoutMs());
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        workspaceId: input.campaign.workspaceId,
        campaignId: input.campaign.id,
        action: input.action,
        version: input.version,
        campaign: {
          redditAccountId: input.campaign.redditAccountId,
          name: input.campaign.name,
          objective: input.campaign.objective,
          status: input.campaign.status,
          budget: {
            dailyBudgetCents: input.campaign.dailyBudgetCents,
            lifetimeBudgetCents: input.campaign.lifetimeBudgetCents,
          },
          schedule: {
            startAt: input.campaign.startAt?.toISOString() ?? null,
            endAt: input.campaign.endAt?.toISOString() ?? null,
          },
          targeting: {
            subreddits: input.campaign.targetSubreddits,
            countries: input.campaign.targetCountries,
            interests: input.campaign.interests,
          },
          creative: {
            headline: input.campaign.headline,
            body: input.campaign.body,
            destinationUrl: input.campaign.destinationUrl,
            ctaText: input.campaign.ctaText,
          },
          externalCampaignId: input.campaign.externalCampaignId,
        },
      }),
    });

    if (!res.ok) {
      const errText = (await res.text()).trim();
      const detail = errText ? `:${errText.slice(0, 140)}` : "";
      throw new Error(`EXTERNAL_SYNC_HTTP_${res.status}${detail}`);
    }

    const payload = (await res.json()) as {
      externalCampaignId?: string | null;
      status?: string | null;
    };

    const externalCampaignId =
      payload.externalCampaignId ?? input.campaign.externalCampaignId ?? null;

    if (input.action === "UPSERT" && !externalCampaignId) {
      throw new Error("EXTERNAL_SYNC_INVALID_RESPONSE");
    }

    return {
      externalCampaignId,
      remoteStatus:
        payload.status ??
        (input.action === "ARCHIVE"
          ? "ARCHIVED"
          : input.action === "PAUSE"
            ? "PAUSED"
            : input.action === "COMPLETE"
              ? "COMPLETED"
              : "ACTIVE"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function syncWithMock(
  input: SyncRedditAdCampaignInput,
): SyncRedditAdCampaignResult {
  const externalCampaignId =
    input.action === "ARCHIVE" && !input.campaign.externalCampaignId
      ? null
      : (input.campaign.externalCampaignId ??
        buildMockExternalCampaignId({
          workspaceId: input.campaign.workspaceId,
          campaignId: input.campaign.id,
        }));

  return {
    externalCampaignId,
    remoteStatus:
      input.action === "ARCHIVE"
        ? "ARCHIVED"
        : input.action === "PAUSE"
          ? "PAUSED"
          : input.action === "COMPLETE"
            ? "COMPLETED"
            : "ACTIVE",
  };
}

export async function syncRedditAdCampaign(
  input: SyncRedditAdCampaignInput,
): Promise<SyncRedditAdCampaignResult> {
  if (getSyncMode() === "webhook") {
    return syncWithWebhook(input);
  }
  return syncWithMock(input);
}
