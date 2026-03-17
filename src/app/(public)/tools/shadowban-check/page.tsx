"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

type ShadowbanCheckResponse = {
  username: string;
  result:
    | "CLEAR"
    | "SHADOWBANNED"
    | "SUSPENDED"
    | "AT_RISK"
    | "NOT_FOUND"
    | "UNREACHABLE";
  reason: string;
  profile: {
    karma: number;
    commentKarma: number;
    accountAgeDays: number | null;
    hasVerifiedEmail: boolean;
    isSuspended: boolean;
    recentActivityCount: number;
  } | null;
  checks: {
    redditProfileReachable: boolean;
    redditProfileStatus: number | null;
    redditProfileTimedOut: boolean;
  };
};

const RESULT_DISPLAY: Record<string, { label: string; color: string }> = {
  CLEAR: { label: "Account looks healthy", color: "text-emerald-600" },
  SHADOWBANNED: { label: "Likely shadowbanned", color: "text-red-600" },
  SUSPENDED: { label: "Account suspended", color: "text-red-600" },
  AT_RISK: { label: "At risk", color: "text-amber-600" },
  NOT_FOUND: { label: "Account not found", color: "text-muted-foreground" },
  UNREACHABLE: { label: "Check failed", color: "text-muted-foreground" },
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

  const display = result
    ? (RESULT_DISPLAY[result.result] ?? RESULT_DISPLAY.UNREACHABLE)
    : null;

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
              Check if a Reddit account is shadowbanned, suspended, or at risk
              of reduced visibility.
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
                  {isLoading ? "Checking..." : "Run check"}
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                We check the public Reddit profile and recent activity. No login
                required.
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
              <p className="text-sm font-semibold">Result</p>
              <p
                className={`mt-3 text-lg font-semibold ${display?.color ?? ""}`}
              >
                {display?.label ?? "Run a check"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {result?.reason ??
                  "Enter a Reddit username to check for shadowban signals."}
              </p>
            </div>

            {result?.profile ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Account details</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Total karma</p>
                    <p
                      className={`text-sm font-semibold ${result.profile.karma < 0 ? "text-red-600" : ""}`}
                    >
                      {result.profile.karma.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Comment karma
                    </p>
                    <p
                      className={`text-sm font-semibold ${result.profile.commentKarma < 0 ? "text-red-600" : ""}`}
                    >
                      {result.profile.commentKarma.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Account age</p>
                    <p className="text-sm font-semibold">
                      {result.profile.accountAgeDays != null
                        ? result.profile.accountAgeDays > 365
                          ? `${Math.floor(result.profile.accountAgeDays / 365)}y ${Math.floor((result.profile.accountAgeDays % 365) / 30)}m`
                          : `${result.profile.accountAgeDays}d`
                        : "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Recent activity
                    </p>
                    <p className="text-sm font-semibold">
                      {result.profile.recentActivityCount > 0
                        ? `${result.profile.recentActivityCount} posts/comments`
                        : "No visible activity"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Email verified
                    </p>
                    <p className="text-sm font-semibold">
                      {result.profile.hasVerifiedEmail ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p
                      className={`text-sm font-semibold ${result.profile.isSuspended ? "text-red-600" : ""}`}
                    >
                      {result.profile.isSuspended ? "Suspended" : "Active"}
                    </p>
                  </div>
                </div>
              </div>
            ) : result ? (
              <div className="rounded-[24px] border border-border bg-background/80 p-6">
                <p className="text-sm font-semibold">Account details</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Could not load profile data. The account may not exist or
                  Reddit may be unreachable.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-10 rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">What this tool checks</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Profile reachability — can Reddit serve the account page?</li>
            <li>Suspension status — is the account flagged by Reddit?</li>
            <li>Visible activity — do posts and comments actually appear?</li>
            <li>Karma health — negative karma triggers automatic filtering.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Start free account
            </Link>
            <Link
              href="/tools/subreddit-analyzer"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Next: Subreddit analyzer
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
