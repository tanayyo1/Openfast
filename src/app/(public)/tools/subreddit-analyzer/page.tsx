"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

type SubredditAnalysis = {
  verdict: string;
  verdictLabel: string;
  verdictSummary: string;
  dealBreakers: Array<{ label: string; value: string; isBlocking: boolean }>;
  rules: Array<{
    category: string;
    title: string;
    detail: string;
    severity: string;
  }>;
  postingStrategy: {
    approach: string;
    tips: Array<{ do: string; dont: string }>;
    bestContentType: string;
  };
  relatedSubreddits: string[];
};

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
  analysis?: SubredditAnalysis | null;
  rules?: string[];
  topTimeWindows?: Array<{
    dayOfWeek: number;
    hourUtc: number;
    score: number;
  }>;
  source?: string;
};

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const VERDICT_STYLES: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  PROMOTION_FRIENDLY: {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  CAUTION: {
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-300 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  NOT_RECOMMENDED: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-300 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  UNKNOWN: {
    bg: "bg-slate-50 dark:bg-slate-900",
    border: "border-slate-300 dark:border-slate-700",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
  },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical:
    "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/50",
  warning:
    "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/50",
  info: "border-border bg-card/80",
};

const CATEGORY_LABELS: Record<string, string> = {
  promotion: "Promotion Rules",
  content: "Content Rules",
  behavior: "Community Rules",
  moderation: "Moderation",
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

  const analysis = result?.analysis;
  const verdictStyle =
    VERDICT_STYLES[analysis?.verdict ?? ""] ?? VERDICT_STYLES.UNKNOWN;

  const rulesByCategory = (analysis?.rules ?? []).reduce(
    (acc, rule) => {
      const cat = rule.category || "content";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(rule);
      return acc;
    },
    {} as Record<string, NonNullable<SubredditAnalysis["rules"]>>,
  );

  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Free tool
            </p>
            <h1 className="mt-4 text-4xl font-semibold">Subreddit analyzer</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Find out if you can promote in a subreddit, what the rules are,
              and how to post without getting banned.
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
              {error ? (
                <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </form>

            {result?.subreddit ? (
              <div className="mt-6 rounded-[24px] border border-border bg-card/80 p-6">
                <p className="text-sm font-semibold">Community stats</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Subscribers</p>
                    <p className="text-sm font-semibold">
                      {formatNumber(result.subreddit.subscribers)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
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
                  <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Data source</p>
                    <p className="text-sm font-semibold">
                      {result.source === "database"
                        ? "Cached"
                        : result.source === "fallback"
                          ? "Estimated"
                          : "Live from Reddit"}
                    </p>
                  </div>
                  {analysis?.postingStrategy?.bestContentType ? (
                    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Best content type
                      </p>
                      <p className="text-sm font-semibold">
                        {analysis.postingStrategy.bestContentType}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {(analysis?.relatedSubreddits?.length ?? 0) > 0 ? (
              <div className="mt-6 rounded-[24px] border border-border bg-card/80 p-6">
                <p className="text-sm font-semibold">Similar subreddits</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis!.relatedSubreddits.map((sub) => (
                    <span
                      key={sub}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                    >
                      r/{sub}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            {analysis ? (
              <div
                className={`rounded-[24px] border p-6 ${verdictStyle.bg} ${verdictStyle.border}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${verdictStyle.dot}`} />
                  <p className={`text-lg font-semibold ${verdictStyle.text}`}>
                    {analysis.verdictLabel}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analysis.verdictSummary}
                </p>
              </div>
            ) : (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-lg font-semibold">
                  Enter a subreddit to analyze
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get a verdict, rule breakdown, and posting strategy in
                  seconds.
                </p>
              </div>
            )}

            {(analysis?.dealBreakers?.length ?? 0) > 0 ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Requirements</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis!.dealBreakers.map((db, i) => (
                    <span
                      key={i}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        db.isBlocking
                          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                          : "border-border bg-background text-foreground"
                      }`}
                    >
                      {db.label}: {db.value}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {Object.keys(rulesByCategory).length > 0 ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Rules breakdown</p>
                <div className="mt-4 space-y-4">
                  {Object.entries(rulesByCategory).map(([cat, rules]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        {CATEGORY_LABELS[cat] ?? cat}
                      </p>
                      <div className="mt-2 space-y-2">
                        {rules.map((rule, i) => (
                          <div
                            key={i}
                            className={`rounded-2xl border px-4 py-3 ${SEVERITY_STYLES[rule.severity] ?? SEVERITY_STYLES.info}`}
                          >
                            <p className="text-sm font-semibold">
                              {rule.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {rule.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis?.postingStrategy ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Posting strategy</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {analysis.postingStrategy.approach}
                </p>
                {analysis.postingStrategy.tips.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {analysis.postingStrategy.tips.map((tip, i) => (
                      <div key={i} className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/50">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Do
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tip.do}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 dark:border-red-900 dark:bg-red-950/50">
                          <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                            Don&apos;t
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tip.dont}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {(result?.topTimeWindows?.length ?? 0) > 0 ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Best times to post</p>
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
            Use these insights to pick the right subreddits. Then generate
            discussion-first drafts that follow the rules.
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
