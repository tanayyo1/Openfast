"use client";

import { FormEvent, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

type ShadowbanCheckResponse = {
  username: string;
  result: "OK" | "SUSPICIOUS";
  checks: {
    redditProfileReachable: boolean;
    redditProfileStatus: number | null;
    redditProfileTimedOut?: boolean;
    internalSampleSize: number;
    internalSuspiciousRate: number;
  };
};

export default function ShadowbanCheckPage() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShadowbanCheckResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!username.trim()) {
      setError("Reddit username is required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/tools/shadowban-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const json = (await res.json()) as ShadowbanCheckResponse & {
        error?: string;
      };

      if (!res.ok) {
        setError(json.error ?? "Failed to run shadowban check.");
        return;
      }

      setResult(json);
    } catch {
      setError("Network error while running shadowban check. Please retry.");
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
            <h1 className="mt-4 text-4xl font-semibold">Shadowban detector</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Check visibility signals and track account health trends.
            </p>
            <form
              className="mt-8 rounded-[24px] border border-border bg-card/80 p-6"
              onSubmit={onSubmit}
            >
              <label className="text-sm font-semibold" htmlFor="username">
                Reddit username
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                >
                  {isLoading ? "Running..." : "Run check"}
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                We store checks only when you connect a Reddit account.
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
              <p className="text-sm font-semibold">Visibility result</p>
              <p className="mt-3 text-lg font-semibold">
                {result
                  ? result.result === "OK"
                    ? "Likely visible"
                    : "Potential visibility risk"
                  : "Run a check"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {result
                  ? result.result === "OK"
                    ? "Profile and recent internal checks look healthy."
                    : "Signals indicate elevated visibility risk. Reduce posting pace and verify with manual checks."
                  : "Use this checker before posting at scale."}
              </p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-6">
              <p className="text-sm font-semibold">Account health snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Profile status
                  </p>
                  <p className="text-sm font-semibold">
                    {result
                      ? result.checks.redditProfileTimedOut
                        ? "Timeout"
                        : result.checks.redditProfileReachable
                          ? "Reachable"
                          : "Unreachable"
                      : "Unknown"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">HTTP status</p>
                  <p className="text-sm font-semibold">
                    {result?.checks.redditProfileStatus ?? "Unknown"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Sample size</p>
                  <p className="text-sm font-semibold">
                    {result?.checks.internalSampleSize ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Suspicious rate
                  </p>
                  <p className="text-sm font-semibold">
                    {result
                      ? `${Math.round(result.checks.internalSuspiciousRate * 100)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
