import Link from "next/link";
import { BarMeter } from "@/components/app/charts/BarMeter";
import { HealthAccountActions } from "@/components/app/health/HealthAccountActions";
import { getHealthGuardrailThresholds } from "@/lib/health/guardrails";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

const DEFAULT_COMMENT_FIRST_MIN_COMMENTS = 3;

function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function cadenceForTier(
  tier: "NEW" | "ESTABLISHED" | "TRUSTED" | "RESTRICTED",
) {
  if (tier === "TRUSTED") return "3 to 5 posts per day";
  if (tier === "ESTABLISHED") return "2 to 3 posts per day";
  if (tier === "NEW") return "Prefer comments; 0 to 1 posts per day";
  return "Comments only until account recovers";
}

function scorePillTone(
  score: number | null,
  blockThreshold: number,
  cautionThreshold: number,
) {
  if (score == null) return "border-slate-300 bg-slate-50 text-slate-700";
  if (score < blockThreshold) return "border-red-300 bg-red-50 text-red-700";
  if (score < cautionThreshold)
    return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

export default async function HealthPage() {
  const session = await requireWorkspaceSessionForPage();
  const healthThresholds = getHealthGuardrailThresholds();
  const commentFirstMinComments = parsePositiveEnvInt(
    "COMMENT_FIRST_MIN_COMMENTS",
    DEFAULT_COMMENT_FIRST_MIN_COMMENTS,
  );

  const accounts = await prisma.redditAccount.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      redditUsername: true,
      safetyTier: true,
      healthSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 5,
        select: {
          id: true,
          healthScore: true,
          capturedAt: true,
        },
      },
      visibilityChecks: {
        orderBy: { checkedAt: "desc" },
        take: 5,
        select: {
          id: true,
          result: true,
          checkedAt: true,
          permalink: true,
          visibleLoggedOut: true,
        },
      },
      publishedItems: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          permalink: true,
        },
      },
    },
  });

  const accountIds = accounts.map((a) => a.id);
  const publishedCommentsByAccount = await prisma.publishedItem.groupBy({
    by: ["redditAccountId"],
    where: {
      workspaceId: session.workspaceId,
      redditAccountId: { in: accountIds },
      type: "COMMENT",
    },
    _count: true,
  });

  const commentCountsMap = new Map(
    publishedCommentsByAccount.map((r) => [r.redditAccountId, r._count]),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Account health
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Protect delivery and trust
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track removals, visibility signals, and recommended pacing tiers.
          </p>
        </div>
        <Link
          href="/opportunities"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Find commenting opportunities
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.length === 0 ? (
          <div className="rounded-[24px] border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No connected Reddit accounts yet.
          </div>
        ) : (
          accounts.map((account) => {
            const latestSnapshot = account.healthSnapshots[0] ?? null;
            const latestVisibility = account.visibilityChecks[0] ?? null;
            const healthScore =
              latestSnapshot != null
                ? Math.round(latestSnapshot.healthScore)
                : null;

            const publishedComments = commentCountsMap.get(account.id) ?? 0;
            const isNewAccount = account.safetyTier === "NEW";
            const canSchedulePosts =
              !isNewAccount || publishedComments >= commentFirstMinComments;
            const remainingComments = isNewAccount
              ? Math.max(0, commentFirstMinComments - publishedComments)
              : 0;

            const warnings: string[] = [];

            if (account.safetyTier === "RESTRICTED") {
              warnings.push(
                "Publishing should stay blocked until account restrictions recover.",
              );
            }
            if (isNewAccount && !canSchedulePosts) {
              warnings.push(
                `Comment-first mode: publish ${remainingComments} more comment(s) before scheduling posts.`,
              );
            }
            if (
              healthScore != null &&
              healthScore < healthThresholds.blockPublishing
            ) {
              warnings.push(
                "High risk detected. Do not schedule posts until health improves.",
              );
            } else if (
              healthScore != null &&
              healthScore < healthThresholds.caution
            ) {
              warnings.push(
                "Health score is low. Prioritize comments and reduce posting pace.",
              );
            }
            if (latestVisibility?.result === "SUSPICIOUS") {
              warnings.push(
                "Latest visibility check is suspicious. Investigate before publishing.",
              );
            }
            if (!latestSnapshot) {
              warnings.push(
                "No health snapshot yet. Run a snapshot before scheduling high-value posts.",
              );
            }

            return (
              <div
                key={account.id}
                className="rounded-[24px] border border-border bg-card/80 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">
                      u/{account.redditUsername}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tier: {account.safetyTier}
                      <span className="mx-2 text-muted-foreground/40">|</span>
                      Suggested cadence: {cadenceForTier(account.safetyTier)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${scorePillTone(
                      healthScore,
                      healthThresholds.blockPublishing,
                      healthThresholds.caution,
                    )}`}
                  >
                    {healthScore == null
                      ? "Score unavailable"
                      : `Score ${healthScore}`}
                  </span>
                </div>

                {healthScore == null ? (
                  <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                    Score unavailable until first health snapshot is captured.
                  </div>
                ) : (
                  <div className="mt-5">
                    <BarMeter label="Health score" value={healthScore} />
                  </div>
                )}

                {isNewAccount && (
                  <div className="mt-5 rounded-2xl border bg-background/70 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Comment-first mode
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {publishedComments} / {commentFirstMinComments}{" "}
                          comments published
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          canSchedulePosts
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-amber-300 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {canSchedulePosts
                          ? "Ready for posts"
                          : `${remainingComments} more needed`}
                      </span>
                    </div>
                    {!canSchedulePosts && (
                      <div className="mt-3 flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                          New accounts must publish comments before scheduling
                          posts to build history and avoid bans.
                        </p>
                        <Link
                          href="/opportunities"
                          className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                        >
                          Find opportunities
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Signals
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {warnings.length === 0 ? (
                      <li>No active health warnings.</li>
                    ) : (
                      warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))
                    )}
                    <li>
                      Last visibility check:{" "}
                      {latestVisibility?.result ?? "UNKNOWN"}
                    </li>
                    <li>
                      Last health snapshot:{" "}
                      {latestSnapshot
                        ? latestSnapshot.capturedAt.toISOString()
                        : "Not captured"}
                    </li>
                  </ul>
                </div>

                <HealthAccountActions
                  accountId={account.id}
                  latestPermalink={account.publishedItems[0]?.permalink ?? null}
                  visibilityHistory={account.visibilityChecks.map((item) => ({
                    id: item.id,
                    result: item.result,
                    checkedAt: item.checkedAt.toISOString(),
                    permalink: item.permalink,
                    visibleLoggedOut: item.visibleLoggedOut,
                  }))}
                  healthHistory={account.healthSnapshots.map((item) => ({
                    id: item.id,
                    healthScore: item.healthScore,
                    capturedAt: item.capturedAt.toISOString(),
                  }))}
                />
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Guardrails</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Approval gate",
              detail:
                "Drafts must be approved before scheduling and publishing.",
            },
            {
              title: "Health block",
              detail: `Scheduling posts is blocked when latest health score is below ${healthThresholds.blockPublishing}.`,
            },
            {
              title: "Comment-first for new accounts",
              detail: `NEW tier accounts must publish ${commentFirstMinComments}+ comments before scheduling posts.`,
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/80 p-5"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
