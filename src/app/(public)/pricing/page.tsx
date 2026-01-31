import Link from 'next/link'
import { MaxWidth } from '@/components/public/MaxWidth'

const plans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'per month',
    description: 'Start with essentials and safety-first guidance.',
    features: [
      '1 project',
      '1 Reddit account',
      'Basic roadmap (7 days)',
      '10 drafts per month',
      'Manual posting only',
    ],
    cta: 'Get started',
  },
  {
    name: 'Pro',
    price: '$39',
    cadence: 'per month',
    description: 'Full planning and scheduling for growing teams.',
    features: [
      '5 projects',
      '3 Reddit accounts',
      'Full roadmap (30 days)',
      'Unlimited drafts',
      'Scheduling + analytics',
    ],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    name: 'Lifetime',
    price: '$129',
    cadence: 'one time',
    description: 'Pay once and keep every Pro feature.',
    features: [
      'Unlimited projects',
      'Unlimited accounts',
      'All Pro features',
      'Priority support',
      'Early access to new tools',
    ],
    cta: 'Claim lifetime',
  },
]

export default function PricingPage() {
  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Pricing
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            Plans built for steady Reddit growth.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            Choose the pace that matches your team. All plans include compliance checks
            and human approval.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[28px] border p-6 text-left shadow-sm ${
                plan.highlight
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card/80'
              }`}
            >
              <p className="text-sm font-semibold text-muted-foreground">
                {plan.name}
              </p>
              <p className="mt-4 text-4xl font-semibold">{plan.price}</p>
              <p className="text-xs text-muted-foreground">{plan.cadence}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                {plan.description}
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                  plan.highlight
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border text-foreground hover:border-foreground/40'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-14 rounded-[28px] border border-border bg-background/70 p-8 text-center">
          <p className="text-sm font-semibold">Need a custom plan?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We can tailor safety pacing, team seats, and reporting for agencies.
          </p>
          <Link
            href="/seo/guides/support"
            className="mt-6 inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/40"
          >
            Contact sales
          </Link>
        </div>
      </MaxWidth>
    </div>
  )
}
