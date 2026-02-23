"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const scopes = [
  {
    name: "identity",
    note: "Read your Reddit username and account metadata.",
  },
  {
    name: "submit",
    note: "Create posts after you approve drafts.",
  },
  {
    name: "read",
    note: "Fetch subreddit data and engagement metrics.",
  },
  {
    name: "history",
    note: "Track your recent submissions and comments for analytics.",
  },
];

const profileOptimizationGuide = [
  "Complete your profile basics before posting (avatar, clear about/bio, consistent username).",
  "Build comment karma first with 2-3 value-first comments per target subreddit.",
  "Avoid links and product mentions in early interactions until trust signals improve.",
  "Keep a consistent cadence (few high-quality interactions daily over bursts).",
  "Refresh account health weekly and resolve removals before scheduling more posts.",
];

const demandScorecardGuide = [
  "Pick 2-4 subreddits with high fit and medium/low risk before scaling volume.",
  "Extract at least 3 recurring pain points so demand signals are not noisy.",
  "Use timing windows only after fit is proven; timing does not fix weak positioning.",
  "If scorecard blockers appear, resolve those before posting promotional content.",
];

type Account = {
  id: string;
  redditUsername: string;
  safetyTier: "NEW" | "WARM" | "ESTABLISHED" | "TRUSTED" | "RESTRICTED";
};

export default function ConnectRedditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId") ?? "";
  const nextPath = projectId
    ? `/onboarding/connect-reddit?projectId=${encodeURIComponent(projectId)}`
    : "/onboarding/connect-reddit";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/reddit/accounts", { cache: "no-store" });
        const json = (await res.json()) as
          | { items?: Account[]; error?: string }
          | undefined;

        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load Reddit accounts");
        }

        if (!cancelled) {
          setAccounts(json?.items ?? []);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load Reddit accounts";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const canContinue = useMemo(() => {
    return accounts.length > 0;
  }, [accounts.length]);
  const roadmapHref = projectId
    ? `/roadmaps/generate?projectId=${encodeURIComponent(projectId)}`
    : "/roadmaps/generate";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Onboarding
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Connect your Reddit account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect at least one Reddit account to generate roadmaps and schedule
          safely.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Permissions requested</p>
          <p className="mt-2 text-sm text-muted-foreground">
            These scopes let us generate roadmaps, schedule posts, and fetch
            analytics.
          </p>
          <div className="mt-5 space-y-3">
            {scopes.map((scope) => (
              <div
                key={scope.name}
                className="rounded-2xl border border-border bg-background/70 p-4"
              >
                <p className="text-sm font-semibold">{scope.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {scope.note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Connect account
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              OAuth will redirect you to Reddit and back after authorization.
            </p>
            <Link
              href={`/api/reddit/oauth/start?next=${encodeURIComponent(nextPath)}`}
              className="mt-4 inline-flex w-full justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Connect with Reddit
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Tokens are encrypted at rest and never written to logs.
          </p>
        </div>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : null}
          {!loading && canContinue ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <p className="text-sm font-semibold">
                Roadmaps unlocked. Your account connection is active.
              </p>
              <p className="mt-1 text-sm">
                Continue to roadmap generation and create your first task plan.
              </p>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Connected accounts</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep accounts healthy by following safe cadence tiers.
            </p>
            {loading ? (
              <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm text-muted-foreground">
                  Loading accounts...
                </p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold">No accounts connected</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Connect at least one account to generate a roadmap.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-2xl border border-border bg-card/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          u/{account.redditUsername}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tier: {account.safetyTier.toLowerCase()}
                        </p>
                      </div>
                      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        Connected
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Safety reminders</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Every post requires explicit approval before scheduling.</li>
              <li>Start with comments on new accounts to build karma.</li>
              <li>Follow subreddit rules and avoid repeated links.</li>
            </ul>
          </div>

          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Profile optimization guide</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this checklist to keep account quality high before scaling
              post volume.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {profileOptimizationGuide.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Demand scorecard guide</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use project demand scorecards to decide where to post first and
              when to hold back.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {demandScorecardGuide.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/onboarding"
          className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
        >
          Back
        </Link>
        <button
          type="button"
          disabled={!canContinue || loading}
          onClick={() => {
            router.push(roadmapHref);
          }}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {canContinue
            ? "Go to roadmap generation"
            : "Connect an account to continue"}
        </button>
      </div>
    </div>
  );
}
