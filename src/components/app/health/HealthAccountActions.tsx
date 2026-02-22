"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type VisibilityHistoryItem = {
  id: string;
  result: "OK" | "SUSPICIOUS" | "UNKNOWN" | "FAILED";
  checkedAt: string;
  permalink: string;
  visibleLoggedOut: boolean | null;
};

type HealthHistoryItem = {
  id: string;
  healthScore: number;
  capturedAt: string;
};

type Props = {
  accountId: string;
  latestPermalink: string | null;
  visibilityHistory: VisibilityHistoryItem[];
  healthHistory: HealthHistoryItem[];
};

function resultTone(result: VisibilityHistoryItem["result"]) {
  if (result === "OK")
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (result === "SUSPICIOUS") return "border-red-300 bg-red-50 text-red-700";
  if (result === "FAILED") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

export function HealthAccountActions({
  accountId,
  latestPermalink,
  visibilityHistory,
  healthHistory,
}: Props) {
  const router = useRouter();
  const [runningVisibility, setRunningVisibility] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const actionRunning = runningVisibility || refreshingHealth;
  const canRunCheck = Boolean(latestPermalink);
  const hasHistory = visibilityHistory.length > 0 || healthHistory.length > 0;

  const newestVisibility = useMemo(
    () => visibilityHistory[0] ?? null,
    [visibilityHistory],
  );

  async function refreshHealthSnapshot() {
    if (actionRunning) return;
    setRefreshingHealth(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/reddit/accounts/${encodeURIComponent(accountId)}/health`,
        { cache: "no-store" },
      );

      const json = (await res.json()) as
        | {
            latestSnapshot?: { healthScore?: number };
            refreshQueued?: boolean;
            warnings?: string[];
            error?: string;
          }
        | undefined;

      if (!res.ok) {
        setError(json?.error ?? "Failed to refresh account health");
        return;
      }

      if (json?.refreshQueued) {
        setNotice("Health snapshot refresh queued. Check back in a minute.");
      } else if (typeof json?.latestSnapshot?.healthScore === "number") {
        setNotice(
          `Latest health score: ${Math.round(json.latestSnapshot.healthScore)}.`,
        );
      } else if (Array.isArray(json?.warnings) && json.warnings.length > 0) {
        setNotice(json.warnings[0] ?? "No health snapshot available yet.");
      } else {
        setNotice("No health snapshot available yet.");
      }

      router.refresh();
    } catch {
      setError("Request failed while refreshing account health.");
    } finally {
      setRefreshingHealth(false);
    }
  }

  async function runVisibilityCheck() {
    if (!latestPermalink || actionRunning) return;
    setRunningVisibility(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/reddit/accounts/${encodeURIComponent(accountId)}/visibility-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permalink: latestPermalink }),
        },
      );

      const json = (await res.json()) as
        | {
            check?: { result?: string };
            error?: string;
            code?: string;
          }
        | undefined;

      if (!res.ok) {
        setError(json?.error ?? "Failed to run visibility check");
        return;
      }

      setNotice(
        `Visibility check complete: ${(json?.check?.result ?? "UNKNOWN").toLowerCase()}.`,
      );
      router.refresh();
    } catch {
      setError("Request failed while running visibility check.");
    } finally {
      setRunningVisibility(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={actionRunning}
          onClick={() => {
            void refreshHealthSnapshot();
          }}
          className="rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {refreshingHealth ? "Refreshing..." : "Refresh health snapshot"}
        </button>
        <button
          type="button"
          disabled={!canRunCheck || actionRunning}
          onClick={() => {
            void runVisibilityCheck();
          }}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {runningVisibility ? "Running..." : "Run visibility check"}
        </button>
        <button
          type="button"
          disabled={!hasHistory}
          onClick={() => setOpenHistory((v) => !v)}
          className="rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {openHistory ? "Hide history" : "View history"}
        </button>
      </div>

      {!canRunCheck ? (
        <p className="text-xs text-muted-foreground">
          No published permalink available yet. Publish at least one
          post/comment before running visibility checks.
        </p>
      ) : null}

      {openHistory ? (
        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Visibility history
          </p>
          {visibilityHistory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No visibility checks recorded yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {visibilityHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-card/80 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${resultTone(
                        item.result,
                      )}`}
                    >
                      {item.result}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.checkedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.visibleLoggedOut === null
                      ? "Logged-out visibility unknown"
                      : item.visibleLoggedOut
                        ? "Visible when logged out"
                        : "Not visible when logged out"}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Health score history
          </p>
          {healthHistory.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No health snapshots recorded yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {healthHistory.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-card/80 px-3 py-2"
                >
                  Score {Math.round(item.healthScore)} on{" "}
                  {new Date(item.capturedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          )}

          {newestVisibility ? (
            <a
              href={newestVisibility.permalink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-xs font-semibold"
            >
              Open latest checked permalink
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
