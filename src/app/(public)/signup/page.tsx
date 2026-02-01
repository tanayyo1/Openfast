"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";
import { useSupabase } from "@/components/providers/SupabaseProvider";

function setDemoAuthCookie() {
  document.cookie = `rf_demo_auth=1; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

export default function SignupPage() {
  const router = useRouter();
  const { supabase, isConfigured } = useSupabase();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="py-16">
      <MaxWidth>
        <div className="mx-auto max-w-md rounded-[28px] border border-border bg-card/80 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Get started
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Create your ReditFast account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with free tools and unlock roadmaps when you are ready.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setMessage(null);
              setLoading(true);

              if (!supabase) {
                setLoading(false);
                setError(
                  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
                );
                return;
              }

              const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: {
                    name,
                  },
                },
              });

              setLoading(false);

              if (error) {
                setError(error.message);
                return;
              }

              if (
                data.user &&
                data.user.identities &&
                data.user.identities.length === 0
              ) {
                setError(
                  "This email is already registered. Please sign in instead.",
                );
                return;
              }

              // Check if email confirmation is required
              if (data.session) {
                // Auto-confirmed (email confirmation disabled)
                // Sync user to our database
                const syncRes = await fetch("/api/auth/sync", {
                  method: "POST",
                });

                if (!syncRes.ok) {
                  console.error("Failed to sync user to database");
                  // Still redirect - auth worked, sync can happen later
                }

                router.push("/onboarding");
              } else {
                // Email confirmation required
                setMessage(
                  "Check your email for a confirmation link to complete your registration.",
                );
              }
            }}
          >
            <div>
              <label className="text-sm font-semibold" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Create a password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
            {error ? (
              <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600">
                {message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
            {!isConfigured ? (
              <p className="text-xs text-muted-foreground">
                Supabase env vars are missing, so sign up is disabled. Use Demo
                create account in development.
              </p>
            ) : null}
            {process.env.NODE_ENV !== "production" ? (
              <button
                type="button"
                onClick={() => {
                  setDemoAuthCookie();
                  router.push("/onboarding");
                }}
                className="w-full rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:bg-muted"
              >
                Demo create account
              </button>
            ) : null}
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            By continuing you agree to the platform terms and community
            guidelines.
          </p>
          <div className="mt-4 text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
