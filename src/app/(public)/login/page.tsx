"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

function setDemoAuthCookie() {
  // Demo-only auth gate for the MVP frontend. Backend auth will replace this.
  document.cookie = `rf_demo_auth=1; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = useMemo(() => {
    const rawNext = searchParams.get("next") ?? "/dashboard";
    return rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";
  }, [searchParams]);

  return (
    <div className="py-16">
      <MaxWidth>
        <div className="mx-auto max-w-md rounded-[28px] border border-border bg-card/80 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Welcome back
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in to ReditFast</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Access your workspaces and review scheduled posts.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);

              const res = await signIn("credentials", {
                redirect: false,
                email,
                password,
                callbackUrl: next,
              });

              setLoading(false);
              if (!res || res.error) {
                setError("Invalid email or password");
                return;
              }

              router.push(res.url ?? next);
            }}
          >
            <div>
              <label className="text-sm font-semibold" htmlFor="email">
                Email address
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
                placeholder="Enter your password"
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
            {process.env.NODE_ENV !== "production" ? (
              <button
                type="button"
                onClick={() => {
                  setDemoAuthCookie();
                  router.push(next);
                }}
                className="w-full rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:bg-muted"
              >
                Demo sign in
              </button>
            ) : null}
          </form>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Forgot password?</span>
            <Link href="/signup" className="text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
