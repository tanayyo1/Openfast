'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { MaxWidth } from '@/components/public/MaxWidth'

function setDemoAuthCookie() {
  document.cookie = `rf_demo_auth=1; Path=/; Max-Age=${60 * 60 * 24 * 30}`
}

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="py-16">
      <MaxWidth>
        <div className="mx-auto max-w-md rounded-[28px] border border-border bg-card/80 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Get started
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Create your ReditFast account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start with free tools and unlock roadmaps when you are ready.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              setLoading(true)

              const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
              })

              if (!res.ok) {
                const data = (await res.json().catch(() => null)) as
                  | { error?: string }
                  | null
                setLoading(false)
                setError(data?.error ?? 'Failed to create account')
                return
              }

              const signInRes = await signIn('credentials', {
                redirect: false,
                email,
                password,
                callbackUrl: '/onboarding',
              })

              setLoading(false)
              if (!signInRes || signInRes.error) {
                setError('Account created, but sign in failed. Please log in.')
                router.push('/login')
                return
              }

              router.push(signInRes.url ?? '/onboarding')
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
                placeholder="Create a password"
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
              {loading ? 'Creating account...' : 'Create account'}
            </button>
            {process.env.NODE_ENV !== 'production' ? (
              <button
                type="button"
                onClick={() => {
                  setDemoAuthCookie()
                  router.push('/onboarding')
                }}
                className="w-full rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:bg-muted"
              >
                Demo create account
              </button>
            ) : null}
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            By continuing you agree to the platform terms and community guidelines.
          </p>
          <div className="mt-4 text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  )
}
