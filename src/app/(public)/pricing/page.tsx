import Link from "next/link";
import { MaxWidth } from "@/components/public/MaxWidth";
import { PricingPlanCta } from "@/components/public/PricingPlanCta";
import { limitsForPlan } from "@/lib/billing/plans";

const freeLimits = limitsForPlan("FREE");
const proLimits = limitsForPlan("PRO");

const plans = [
  {
    plan: "FREE" as const,
    name: "Free",
    price: "$0",
    cadence: "per month",
    bestFor: "Solo founders validating the first Reddit growth loop.",
    notFor: "Teams that need multi-account scale and advanced analytics.",
    description: "Safety-first baseline to ship useful posts without burnout.",
    features: [
      `${freeLimits.maxProjects} project`,
      `${freeLimits.maxRedditAccounts} Reddit account`,
      `${freeLimits.roadmapDays}-day roadmap horizon`,
      `${freeLimits.maxDraftsPerMonth} AI drafts / month`,
      `Up to ${freeLimits.maxScheduledPosts} scheduled items`,
      "Manual approval required before publish",
    ],
    cta: "Get started",
  },
  {
    plan: "PRO" as const,
    name: "Pro",
    price: "$39",
    cadence: "per month",
    bestFor: "Operators running repeatable weekly Reddit execution loops.",
    notFor: "Enterprise orgs needing dedicated support and custom controls.",
    description:
      "Scale output with Smart Finder, analytics, and safer queueing.",
    features: [
      `${proLimits.maxProjects} projects`,
      `${proLimits.maxRedditAccounts} Reddit accounts`,
      `${proLimits.roadmapDays}-day roadmap horizon`,
      `${proLimits.maxDraftsPerMonth.toLocaleString()} AI drafts / month`,
      `Up to ${proLimits.maxScheduledPosts} scheduled items`,
      "Smart Finder + advanced analytics",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
];

export default function PricingPage() {
  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Pricing
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            Simple pricing for the operator loop.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            Pick the package that matches your stage. Every plan keeps human
            approval as a hard gate so nothing posts unattended.
          </p>
        </div>
        <div className="mt-8 grid gap-4 rounded-[24px] border border-border bg-card/70 p-6 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Shared foundation
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Draft compliance checks + anti-pattern warnings on every variant.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Safety behavior
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Human approval required before scheduling and publishing.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Upgrade trigger
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Move to Pro once you run multiple projects/accounts weekly.
            </p>
          </div>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[28px] border p-6 text-left shadow-sm ${
                plan.highlight
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card/80"
              }`}
            >
              <p className="text-sm font-semibold text-muted-foreground">
                {plan.name}
              </p>
              <p className="mt-4 text-4xl font-semibold">{plan.price}</p>
              <p className="text-xs text-muted-foreground">{plan.cadence}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Best for
              </p>
              <p className="mt-1 text-sm">{plan.bestFor}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Not for
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.notFor}
              </p>
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
              <div className="mt-6">
                <PricingPlanCta
                  plan={plan.plan}
                  cta={plan.cta}
                  className={`inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      : "border border-border text-foreground hover:border-foreground/40"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 rounded-[28px] border border-border bg-background/70 p-8 text-center">
          <p className="text-sm font-semibold">Need a custom plan?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We can tailor safety pacing, team seats, and reporting for agencies.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/seo/guides/support"
              className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/40"
            >
              Contact sales
            </Link>
            <Link
              href="/trust-center"
              className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/40"
            >
              Trust center
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
