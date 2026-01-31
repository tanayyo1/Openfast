import Link from 'next/link'
import { MaxWidth } from '@/components/public/MaxWidth'

export default function SignupPage() {
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
          <form className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
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
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-foreground/40 focus:outline-none"
              />
            </div>
            <button
              type="button"
              className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Create account
            </button>
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
