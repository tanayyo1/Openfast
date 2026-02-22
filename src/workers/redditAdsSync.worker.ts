import type { Job } from "bullmq";
import type { RedditAdCampaignStatus } from "@prisma/client";
import type {
  RedditAdsSyncAction,
  RedditAdsSyncJobData,
} from "@/lib/queue/enqueue";
import { prisma } from "@/lib/prisma";
import { syncRedditAdCampaign } from "@/lib/redditAds/externalSync";
import {
  normalizeWorkerError,
  permanentWorkerError,
  retryableWorkerError,
  toJobFailure,
  toStoredError,
} from "@/workers/workerErrors";
import { logWorkerEvent } from "@/workers/workerLog";

function classifySyncError(err: unknown) {
  const normalized = normalizeWorkerError(err, "REDDIT_ADS_SYNC_FAILED");
  const message = normalized.message || "Worker failed";

  if (message.includes("EXTERNAL_SYNC_CONFIG_MISSING_ENDPOINT")) {
    return permanentWorkerError(
      "EXTERNAL_SYNC_CONFIG_MISSING_ENDPOINT",
      "REDDIT_ADS_SYNC_ENDPOINT is required for webhook sync mode",
    );
  }

  if (message.includes("EXTERNAL_SYNC_INVALID_RESPONSE")) {
    return permanentWorkerError(
      "EXTERNAL_SYNC_INVALID_RESPONSE",
      "External sync provider response was missing required fields",
    );
  }

  const statusMatch = message.match(/EXTERNAL_SYNC_HTTP_(\d{3})/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status >= 500 || status === 429) {
      return retryableWorkerError(
        "EXTERNAL_SYNC_RATE_OR_SERVER_ERROR",
        `External sync provider returned ${status}`,
      );
    }
    return permanentWorkerError(
      "EXTERNAL_SYNC_CLIENT_ERROR",
      `External sync provider returned ${status}`,
    );
  }

  return normalized;
}

function actionForStatus(
  status: RedditAdCampaignStatus,
): RedditAdsSyncAction | null {
  if (status === "ACTIVE") return "UPSERT";
  if (status === "PAUSED") return "PAUSE";
  if (status === "COMPLETED") return "COMPLETE";
  if (status === "ARCHIVED") return "ARCHIVE";
  return null;
}

export async function processRedditAdsSyncJob(job: Job<RedditAdsSyncJobData>) {
  const { workspaceId, campaignId, status, action, trigger, version } =
    job.data;
  if (
    !workspaceId ||
    !campaignId ||
    !status ||
    !action ||
    !trigger ||
    !version
  ) {
    throw toJobFailure(
      permanentWorkerError(
        "INVALID_JOB_DATA",
        "workspaceId, campaignId, status, action, trigger, and version are required",
      ),
    );
  }

  const campaign = await prisma.redditAdCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: {
      id: true,
      workspaceId: true,
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
      updatedAt: true,
    },
  });

  if (!campaign) {
    throw toJobFailure(
      permanentWorkerError(
        "CAMPAIGN_NOT_FOUND",
        "Campaign not found in workspace",
      ),
    );
  }

  const latestVersion = campaign.updatedAt.toISOString();
  if (campaign.status !== status || latestVersion !== version) {
    logWorkerEvent("reddit_ads_sync", "info", "job.skipped_stale", {
      jobId: String(job.id ?? ""),
      campaignId,
      queuedStatus: status,
      latestStatus: campaign.status,
      queuedVersion: version,
      latestVersion,
    });
    return {
      campaignId,
      status: "skipped_stale" as const,
      latestStatus: campaign.status,
      latestVersion,
    };
  }

  const normalizedAction = actionForStatus(campaign.status);
  if (!normalizedAction) {
    return {
      campaignId,
      status: "skipped_draft" as const,
      latestStatus: campaign.status,
    };
  }

  const jobAction = normalizedAction === action ? action : normalizedAction;

  try {
    const syncResult = await syncRedditAdCampaign({
      campaign,
      action: jobAction,
      version,
    });

    const updated = await prisma.redditAdCampaign.update({
      where: { id: campaign.id },
      data: {
        externalCampaignId: syncResult.externalCampaignId,
        syncError: null,
        launchedAt:
          campaign.status === "ACTIVE" && campaign.launchedAt == null
            ? new Date()
            : campaign.launchedAt,
        archivedAt:
          campaign.status === "ARCHIVED" && campaign.archivedAt == null
            ? new Date()
            : campaign.archivedAt,
      },
      select: {
        id: true,
        status: true,
        externalCampaignId: true,
        updatedAt: true,
      },
    });

    logWorkerEvent("reddit_ads_sync", "info", "job.synced", {
      jobId: String(job.id ?? ""),
      campaignId: updated.id,
      status: updated.status,
      action: jobAction,
      trigger,
      remoteStatus: syncResult.remoteStatus,
    });

    return {
      campaignId: updated.id,
      status: "synced" as const,
      action: jobAction,
      remoteStatus: syncResult.remoteStatus,
      externalCampaignId: updated.externalCampaignId,
      updatedAt: updated.updatedAt.toISOString(),
    };
  } catch (err) {
    const normalized = classifySyncError(err);

    await prisma.redditAdCampaign
      .update({
        where: { id: campaign.id },
        data: {
          syncError: toStoredError(normalized),
        },
      })
      .catch(() => null);

    logWorkerEvent("reddit_ads_sync", "error", "job.failed", {
      jobId: String(job.id ?? ""),
      campaignId,
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.isRetryable,
    });

    throw toJobFailure(normalized);
  }
}
