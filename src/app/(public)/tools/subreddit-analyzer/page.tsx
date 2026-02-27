"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

type AnalyzerResponse = {
  queued?: boolean;
  message?: string;
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
    promoAllowed: boolean;
    linkPolicy: string;
    flairRequired: boolean;
    noLinksInPosts: boolean;
    textOnly: boolean;
  } | null;
  topTimeWindows?: Array<{ dayOfWeek: number; hourUtc: number; score: number }>;
  staleHours?: number;
  queuedRefresh?: boolean;
};

function toDayLabel(dayOfWeek: number) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[dayOfWeek] ?? `Day ${dayOfWeek}`;
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
              Check rules, activity, and best-time windows before posting so you
              avoid low-fit or high-risk subreddits.
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
              {result?.queued ? (
                <p className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                  {result.message ??
                    "Subreddit is being fetched. Retry in a few seconds."}
                </p>
              ) : null}
            </form>
          </div>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Rule summary</p>
              {result?.policy ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>
                    Link policy:{" "}
                    <span className="font-semibold text-foreground">
                      {result.policy.linkPolicy}
                    </span>
                  </li>
                  <li>
                    Promo allowed:{" "}
                    <span className="font-semibold text-foreground">
                      {result.policy.promoAllowed ? "Yes" : "No"}
                    </span>
                  </li>
                  <li>
                    Flair required:{" "}
                    <span className="font-semibold text-foreground">
                      {result.policy.flairRequired ? "Yes" : "No"}
                    </span>
                  </li>
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Analyze a subreddit to preview policy and rule signals.
                </p>
              )}
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Best-time windows</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(result?.topTimeWindows?.length
                  ? result.topTimeWindows
                  : []
                ).map((slot, index) => (
                  <div
                    key={`${slot.dayOfWeek}-${slot.hourUtc}-${index}`}
                    className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm font-semibold"
                  >
                    {toDayLabel(slot.dayOfWeek)}{" "}
                    {String(slot.hourUtc).padStart(2, "0")}
                    :00 UTC
                  </div>
                ))}
                {!result?.topTimeWindows?.length ? (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    No cached windows yet. Run analysis and retry after ingest.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Risk signals</p>
              {result?.subreddit ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                    <p className="text-sm font-semibold">
                      {result.subreddit.subscribers ?? "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Active users
                    </p>
                    <p className="text-sm font-semibold">
                      {result.subreddit.activeUsers ?? "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Restriction</p>
                    <p className="text-sm font-semibold">
                      {result.subreddit.isRestricted ? "Restricted" : "Open"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Stale hours</p>
                    <p className="text-sm font-semibold">
                      {typeof result.staleHours === "number"
                        ? result.staleHours
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Analyze a subreddit to see activity and moderation signals.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-10 rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Turn insights into execution</p>
          <p className="mt-2 text-sm text-muted-foreground">
            In the full app, these signals feed recommendations, task planning,
            and approval-first scheduling.
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
