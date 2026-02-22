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

type ConnectedAccount = {
  id: string;
  redditUsername: string;
  safetyTier: "NEW" | "ESTABLISHED" | "TRUSTED" | "RESTRICTED";
};

type OAuthStatusResponse = {
  oauthConfigured: boolean;
  localModeSession: boolean;
  devConnectAvailable: boolean;
  error?: string;
  code?: string;
};

function mapAuthLikeError(code?: string, fallback?: string) {
  if (code === "SUPABASE_NOT_CONFIGURED") {
    return "Auth is not configured. Set Supabase env vars, then retry.";
  }
  if (code === "UNAUTHORIZED") {
    return "Your session expired. Sign in again and retry.";
  }
  if (code === "WORKSPACE_REQUIRED" || code === "USER_NOT_SYNCED") {
    return "Workspace session is missing. Reload onboarding and try again.";
  }
  return fallback ?? "Request failed.";
}

export default function ConnectRedditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId") ?? "";

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [username, setUsername] = useState("");
  const [tier, setTier] = useState<"NEW" | "ESTABLISHED">("NEW");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingOAuth, setIsCheckingOAuth] = useState(true);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [localModeSession, setLocalModeSession] = useState(false);
  const [devConnectAvailable, setDevConnectAvailable] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [oauthStatusError, setOauthStatusError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadAccounts() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/reddit/accounts", { cache: "no-store" });
      const json = (await res.json()) as {
        items?: ConnectedAccount[];
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setAccountsError(
          mapAuthLikeError(json.code, json.error) ??
            "Failed to load connected accounts",
        );
        setAccounts([]);
        return;
      }
      setAccounts(json.items ?? []);
      setAccountsError(null);
    } catch {
      setAccountsError("Network issue while loading accounts");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOAuthStatus() {
    setIsCheckingOAuth(true);
    try {
      const res = await fetch("/api/reddit/oauth/status", {
        cache: "no-store",
      });
      const json = (await res.json()) as OAuthStatusResponse;
      if (!res.ok) {
        setOauthStatusError(
          mapAuthLikeError(json.code, json.error) ??
            "Failed to load OAuth status.",
        );
        setOauthConfigured(false);
        setLocalModeSession(false);
        setDevConnectAvailable(false);
        return;
      }

      setOauthConfigured(Boolean(json.oauthConfigured));
      setLocalModeSession(Boolean(json.localModeSession));
      setDevConnectAvailable(Boolean(json.devConnectAvailable));
      setOauthStatusError(null);
    } catch {
      setOauthStatusError("Network issue while loading OAuth status.");
      setOauthConfigured(false);
      setLocalModeSession(false);
      setDevConnectAvailable(false);
    } finally {
      setIsCheckingOAuth(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
    void loadOAuthStatus();
  }, []);

  const canContinue = useMemo(() => accounts.length > 0, [accounts.length]);
  const oauthNextPath = useMemo(() => {
    if (!projectId) return "/onboarding/connect-reddit";
    return `/onboarding/connect-reddit?projectId=${encodeURIComponent(projectId)}`;
  }, [projectId]);
  const oauthStartUrl = useMemo(
    () => `/api/reddit/oauth/start?next=${encodeURIComponent(oauthNextPath)}`,
    [oauthNextPath],
  );
  const error = actionError ?? oauthStatusError ?? accountsError;

  async function startOAuth() {
    if (isCheckingOAuth) return;
    if (!oauthConfigured) {
      setActionError(
        "Reddit OAuth is not configured yet. Use local connect while API approval is pending.",
      );
      return;
    }
    setActionError(null);
    window.location.assign(oauthStartUrl);
  }

  async function connectLocalAccount() {
    const clean = username.trim();
    if (!clean) {
      setActionError("Enter a Reddit username to connect.");
      return;
    }

    setActionError(null);
    setIsConnecting(true);
    try {
      const res = await fetch("/api/reddit/accounts/dev-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean, tier }),
      });

      const json = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        if (json.code === "ACCOUNT_ALREADY_CONNECTED") {
          setActionError("That account is already connected.");
        } else if (json.code === "TOKEN_ENCRYPTION_NOT_CONFIGURED") {
          setActionError(
            "Token encryption is not configured. Check TOKEN_ENCRYPTION_KEYS.",
          );
        } else if (json.code === "VALIDATION_ERROR") {
          setActionError(
            "Username must be 3-20 chars and only use letters, numbers, _ or -.",
          );
        } else if (json.code === "FORBIDDEN") {
          setActionError("Local mock connect is disabled in production mode.");
        } else {
          setActionError(
            mapAuthLikeError(json.code, json.error) ??
              "Failed to connect local account.",
          );
        }
        return;
      }

      setUsername("");
      await loadAccounts();
      setActionError(null);
    } catch {
      setActionError("Network issue while connecting account.");
    } finally {
      setIsConnecting(false);
    }
  }

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
          Connect with OAuth when available. If approval is still pending, use
          local connect to continue onboarding.
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

          <button
            type="button"
            onClick={startOAuth}
            disabled={isCheckingOAuth || !oauthConfigured}
            className="mt-6 block w-full rounded-full border border-border px-5 py-3 text-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCheckingOAuth
              ? "Checking OAuth..."
              : oauthConfigured
                ? "Connect with Reddit OAuth"
                : "OAuth not configured yet"}
          </button>
          {!isCheckingOAuth && !oauthConfigured ? (
            <p className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
              Reddit OAuth is currently unavailable in this environment. You can
              continue with local connect for onboarding.
            </p>
          ) : null}

          <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Local mode connect
            </p>
            {!devConnectAvailable ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Local mode connect is disabled in production.
              </p>
            ) : localModeSession ? (
              <p className="mt-3 text-xs text-muted-foreground">
                You are in local mode. Connected accounts are placeholder tokens
                for safe testing.
              </p>
            ) : null}
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
                    setTier(event.target.value as "NEW" | "ESTABLISHED")
                  }
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                >
                  <option value="NEW">NEW</option>
                  <option value="ESTABLISHED">ESTABLISHED</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={connectLocalAccount}
              disabled={isConnecting || !devConnectAvailable}
              className="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isConnecting ? "Connecting..." : "Connect local account"}
            </button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Tokens are encrypted at rest. Local mode stores placeholder
            credentials only.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-background/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Connected accounts</p>
              <button
                type="button"
                onClick={() => void loadAccounts()}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
              >
                Refresh
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep accounts healthy by following safe cadence tiers.
            </p>
            {isLoading ? (
              <div className="mt-4 rounded-2xl border border-border bg-card/80 p-4 text-sm text-muted-foreground">
                Loading accounts...
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
                          Tier: {account.safetyTier}
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

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

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
