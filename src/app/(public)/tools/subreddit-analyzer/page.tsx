"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

type AnalyzerResponse = {
  subreddit?: {
    name: string;
    title: string | null;
    subscribers: number | null;
    activeUsers: number | null;
    nsfw: boolean;
    isRestricted: boolean;
    isQuarantined: boolean;
  };
  policy?: {
    promoAllowed: boolean | null;
    linkPolicy: string | null;
    flairRequired: boolean;
    noLinksInPosts: boolean;
    textOnly: boolean;
  } | null;
  rules?: string[];
  topTimeWindows?: Array<{ dayOfWeek: number; hourUtc: number; score: number }>;
  staleHours?: number;
  source?: string;
};

function toDayLabel(dayOfWeek: number) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function SubredditAnalyzerPage() {
  const [subreddit, setSubreddit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzerResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const normalized = subreddit.trim();
    if (!normalized) {
      setError("Subreddit name is required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/tools/subreddit-analyzer?name=${encodeURIComponent(normalized)}`,
      );
      const json = (await res.json()) as AnalyzerResponse & { error?: string };

      if (!res.ok) {
        setError(json.error ?? "Failed to analyze subreddit.");
        return;
      }

      setResult(json);
    } catch {
      setError("Network error while analyzing subreddit. Please retry.");
    } finally {
      setIsLoading(false);
    }
  }

  const hasRules = (result?.rules?.length ?? 0) > 0;
  const hasPolicy = result?.policy && result.policy.promoAllowed != null;

  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Free tool
            </p>
            <h1 className="mt-4 text-4xl font-semibold">Subreddit analyzer</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Check rules, activity, and posting policies before you commit to a
              subreddit. Know what's allowed before you post.
            </p>
            <form
              className="mt-8 rounded-[24px] border border-border bg-card/80 p-6"
              onSubmit={onSubmit}
            >
              <label className="text-sm font-semibold" htmlFor="subreddit">
                Subreddit name
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="subreddit"
                  type="text"
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  placeholder="r/startups"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                >
                  {isLoading ? "Analyzing..." : "Analyze"}
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Results are cached for faster analysis and lower rate limits.
              </p>
              {error ? (
                <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </form>
          </div>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Rules</p>
              {hasRules ? (
                <ul className="mt-4 space-y-2">
                  {result!.rules!.map((rule, i) => (
                    <li
                      key={i}
                      className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground"
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
              ) : hasPolicy ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>
                    Promo allowed:{" "}
                    <span className="font-semibold text-foreground">
                      {result!.policy!.promoAllowed === null
                        ? "Unknown"
                        : result!.policy!.promoAllowed
                          ? "Yes"
                          : "No"}
                    </span>
                  </li>
                  <li>
                    Link policy:{" "}
                    <span className="font-semibold text-foreground">
                      {result!.policy!.linkPolicy ?? "Unknown"}
                    </span>
                  </li>
                  <li>
                    Flair required:{" "}
                    <span className="font-semibold text-foreground">
                      {result!.policy!.flairRequired ? "Yes" : "No"}
                    </span>
                  </li>
                  <li>
                    Text only:{" "}
                    <span className="font-semibold text-foreground">
                      {result!.policy!.textOnly ? "Yes" : "No"}
                    </span>
                  </li>
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {result
                    ? "No rules data available for this subreddit."
                    : "Enter a subreddit name to see its rules and posting policies."}
                </p>
              )}
            </div>

            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Community stats</p>
              {result?.subreddit ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(result.subreddit.subscribers)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Active users
                    </p>
                    <p className="text-sm font-semibold">
                      {result.subreddit.activeUsers
                        ? formatNumber(result.subreddit.activeUsers)
                        : "Not available"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reddit only shares this for logged-in users.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm font-semibold">
                      {result.subreddit.isQuarantined
                        ? "Quarantined"
                        : result.subreddit.isRestricted
                          ? "Restricted"
                          : result.subreddit.nsfw
                            ? "NSFW"
                            : "Public"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Data source</p>
                    <p className="text-sm font-semibold">
                      {result.source === "database"
                        ? "Cached"
                        : result.source === "fallback"
                          ? "Estimated (Reddit unavailable)"
                          : "Live from Reddit"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Analyze a subreddit to see community stats.
                </p>
              )}
            </div>

            {(result?.topTimeWindows?.length ?? 0) > 0 ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Best-time windows</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {result!.topTimeWindows!.map((slot, index) => (
                    <div
                      key={`${slot.dayOfWeek}-${slot.hourUtc}-${index}`}
                      className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm font-semibold"
                    >
                      {toDayLabel(slot.dayOfWeek)}{" "}
                      {String(slot.hourUtc).padStart(2, "0")}:00 UTC
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-10 rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">What to do next</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use these insights to pick the right subreddits for your product.
            Then generate discussion-first drafts that follow the rules.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Start free account
            </Link>
            <Link
              href="/tools/post-generator"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Next: Post generator
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
