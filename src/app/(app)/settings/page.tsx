"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

function clearDemoAuthCookie() {
  document.cookie = "rf_demo_auth=; Path=/; Max-Age=0";
}

export default function SettingsPage() {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLocalModeSession, setIsLocalModeSession] = useState(false);

  useEffect(() => {
    const hasDemoAuth = document.cookie
      .split(";")
      .some((cookie) => cookie.trim() === "rf_demo_auth=1");
    setIsLocalModeSession(hasDemoAuth);
  }, []);

  async function resetWorkspaceData() {
    const confirmed = window.confirm(
      "This will permanently delete workspace projects, Reddit accounts, and analytics events. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setIsResetting(true);
    setResetMessage(null);
    setResetError(null);

    try {
      const res = await fetch("/api/workspaces/current/reset", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
        reset?: {
          projects: number;
          redditAccounts: number;
          analyticsEvents: number;
        };
      } | null;

      if (!res.ok || !body?.reset) {
        if (body?.code === "LOCAL_MODE_SESSION_FORBIDDEN") {
          setResetError(
            "Reset requires a real Supabase admin session. Sign out of local mode and sign in normally.",
          );
          return;
        }
        if (body?.code === "FORBIDDEN") {
          setResetError("Only workspace admins can reset workspace data.");
          return;
        }
        if (body?.code === "LOCAL_RESET_DISABLED") {
          setResetError("Workspace reset is disabled in production.");
          return;
        }

        setResetError(body?.error ?? "Failed to reset workspace data.");
        return;
      }

      const { projects, redditAccounts, analyticsEvents } = body.reset;
      setResetMessage(
        `Reset complete. Removed ${projects} project(s), ${redditAccounts} Reddit account(s), and ${analyticsEvents} analytics event(s).`,
      );
    } catch {
      setResetError(
        "Failed to reset workspace data. Check your network and retry.",
      );
    } finally {
      setIsResetting(false);
    }
  }

  async function signOut() {
    setIsSigningOut(true);
    clearDemoAuthCookie();
    try {
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        const supabase = createSupabaseClient();
        await supabase.auth.signOut();
      }
    } finally {
      router.push("/login");
      router.refresh();
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Workspace Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your workspace, reset data, or sign out.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Reset Workspace Data</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Delete local workspace projects, connected Reddit accounts, and
            analytics events.
          </p>
          <button
            type="button"
            onClick={resetWorkspaceData}
            disabled={isResetting || isLocalModeSession}
            className="mt-6 rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            {isResetting ? "Resetting..." : "Reset workspace data"}
          </button>
          {isLocalModeSession ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Local-mode sessions cannot run workspace reset. Sign in with a
              real admin account.
            </p>
          ) : null}
          {resetMessage ? (
            <p className="mt-3 text-xs text-emerald-600">{resetMessage}</p>
          ) : null}
          {resetError ? (
            <p className="mt-3 text-xs text-destructive">{resetError}</p>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Sign out</p>
          <p className="mt-2 text-sm text-muted-foreground">
            End this local session and return to the login page.
          </p>
          <button
            type="button"
            onClick={signOut}
            disabled={isSigningOut}
            className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
