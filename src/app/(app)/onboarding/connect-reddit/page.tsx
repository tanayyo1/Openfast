"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useDemoStore } from "@/stores/demoStore";

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

export default function ConnectRedditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId") ?? "";

  const connectRedditAccount = useDemoStore(
    (state) => state.connectRedditAccount,
  );
  const accounts = useDemoStore((state) => state.redditAccounts);

  const [username, setUsername] = useState("");
  const [tier, setTier] = useState<"New" | "Established">("New");

  const canContinue = useMemo(() => {
    return accounts.length > 0;
  }, [accounts.length]);

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
          Demo-only UI. Backend OAuth will replace this flow.
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
              Connect (demo)
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold" htmlFor="username">
                  Reddit username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="founder_handle"
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold" htmlFor="tier">
                  Account tier
                </label>
                <select
                  id="tier"
                  value={tier}
                  onChange={(event) =>
                    setTier(event.target.value as "New" | "Established")
                  }
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  <option value="New">New</option>
                  <option value="Established">Established</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const clean = username.trim();
                if (!clean) return;
                connectRedditAccount({ username: clean, tier });
                setUsername("");
              }}
              className="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Connect account
            </button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Tokens are never stored in logs. Demo mode stores no real
            credentials.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Connected accounts</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep accounts healthy by following safe cadence tiers.
            </p>
            {accounts.length === 0 ? (
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
                          u/{account.username}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tier: {account.tier}
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
          disabled={!canContinue}
          onClick={() => {
            const base = projectId
              ? `/roadmaps/generate?projectId=${encodeURIComponent(projectId)}`
              : "/roadmaps/generate";
            router.push(base);
          }}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
