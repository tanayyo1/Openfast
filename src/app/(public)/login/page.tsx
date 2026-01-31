'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MaxWidth } from '@/components/public/MaxWidth'

function setDemoAuthCookie() {
  // Demo-only auth gate for the MVP frontend. Backend auth will replace this.
  document.cookie = `rf_demo_auth=1; Path=/; Max-Age=${60 * 60 * 24 * 30}`
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

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
          <form className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
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
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDemoAuthCookie()
                router.push(next)
              }}
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Sign in
            </button>
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
  )
}
