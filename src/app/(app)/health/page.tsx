import Link from "next/link";
import { BarMeter } from "@/components/app/charts/BarMeter";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

function cadenceForTier(tier: "NEW" | "ESTABLISHED" | "TRUSTED" | "RESTRICTED") {
  if (tier === "TRUSTED") return "3 to 5 posts per day";
  if (tier === "ESTABLISHED") return "2 to 3 posts per day";
  if (tier === "NEW") return "Prefer comments; 0 to 1 posts per day";
  return "Comments only until account recovers";
}

function scorePillTone(score: number | null) {
  if (score == null) return "border-slate-300 bg-slate-50 text-slate-700";
  if (score < 30) return "border-red-300 bg-red-50 text-red-700";
  if (score < 45) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

export default async function HealthPage() {
  const session = await requireWorkspaceSession();

  const accounts = await prisma.redditAccount.findMany({
    where: { workspaceId: session.workspaceId, isActive: true },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      redditUsername: true,
      safetyTier: true,
      healthSnapshots: {
        orderBy: { capturedAt: "desc" },
        take: 1,
        select: {
          healthScore: true,
          capturedAt: true,
        },
      },
      visibilityChecks: {
        orderBy: { checkedAt: "desc" },
        take: 1,
        select: {
          result: true,
          checkedAt: true,
        },
      },
    },
  });

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
          View opportunities
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
            const warnings: string[] = [];

            if (account.safetyTier === "RESTRICTED") {
              warnings.push(
                "Publishing should stay blocked until account restrictions recover.",
              );
            }
            if (healthScore != null && healthScore < 30) {
              warnings.push(
                "High risk detected. Do not schedule posts until health improves.",
              );
            } else if (healthScore != null && healthScore < 45) {
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
                    className={`rounded-full border px-3 py-1 text-xs ${scorePillTone(healthScore)}`}
                  >
                    {healthScore == null ? "Score unavailable" : `Score ${healthScore}`}
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
                      Last visibility check: {latestVisibility?.result ?? "UNKNOWN"}
                    </li>
                    <li>
                      Last health snapshot:{" "}
                      {latestSnapshot
                        ? latestSnapshot.capturedAt.toISOString()
                        : "Not captured"}
                    </li>
                  </ul>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Run visibility check
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
                  >
                    View history
                  </button>
                </div>
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
              detail:
                "Scheduling posts is blocked when latest health score is below 30.",
            },
            {
              title: "Comments-first fallback",
              detail:
                "When health is low, prioritize comments before attempting post scheduling.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/80 p-5"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
