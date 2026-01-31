import Link from 'next/link'

const steps = [
  {
    title: 'Create your first project',
    description: 'Define your product, goals, and target subreddits.',
    action: 'Create project',
  },
  {
    title: 'Connect Reddit account',
    description: 'Secure OAuth connection with rate limits and token encryption.',
    action: 'Connect account',
  },
  {
    title: 'Generate your roadmap',
    description: 'Get a compliance-safe schedule with suggested time windows.',
    action: 'Generate roadmap',
  },
]

export default function OnboardingPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Onboarding
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Set up your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete these steps to unlock scheduling and analytics.
        </p>
      </div>

      <div className="grid gap-4">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="rounded-[24px] border border-border bg-card/80 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-lg font-semibold">{step.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
              >
                {step.action}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Need help?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Read the onboarding guide or contact support for a live walkthrough.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/seo/guides/getting-started"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Read guide
          </Link>
          <Link
            href="/seo/guides/support"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
