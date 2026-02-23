import Link from "next/link";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { MaxWidth } from "@/components/public/MaxWidth";

const heroSignals = [
  "Safe output by default",
  "Lower ban-risk workflow",
  "Fast weekly execution loop",
];

const proofCards = [
  {
    label: "Risk Score",
    value: "12 / 100",
    detail: "Draft checked against subreddit policy hints before approval",
  },
  {
    label: "Time To First Value",
    value: "< 20 min",
    detail: "Connect, generate first roadmap, and ship first safe draft cycle",
  },
  {
    label: "Approval Gate",
    value: "100%",
    detail: "Nothing posts without explicit human approval",
  },
];

const pillars = [
  {
    title: "Find where you can post safely",
    description:
      "Map product goals to subreddits with rules, risk context, and realistic timing windows.",
  },
  {
    title: "Generate drafts without spam patterns",
    description:
      "Create variants with compliance cues and keep only drafts that pass risk checks.",
  },
  {
    title: "Ship fast with guardrails on",
    description:
      "Use approval-first scheduling with queue safety and post-publish feedback loops.",
  },
];

const steps = [
  {
    title: "Create project + connect Reddit",
    detail:
      "Set tone, goals, and constraints. Then connect Reddit via OAuth with encrypted token storage.",
  },
  {
    title: "Generate recommendations + roadmap",
    detail:
      "Pick top subreddits and receive day-by-day post/comment tasks with suggested time windows.",
  },
  {
    title: "Approve, schedule, improve",
    detail:
      "Review every draft, schedule safely, and use analytics snapshots to improve the next cycle.",
  },
];

const featureGrid = [
  {
    title: "Safety-first activation",
    body: "Three clear steps to first value: create project, connect account, generate roadmap.",
  },
  {
    title: "Draft lifecycle controls",
    body: "Move drafts through review states before scheduling to avoid accidental risky posting.",
  },
  {
    title: "Queue-backed execution",
    body: "Use deterministic jobs and retries to prevent duplicate or unsafe publish behavior.",
  },
  {
    title: "Feedback loop analytics",
    body: "Track risk, engagement, and timing to improve the next cycle instead of guessing.",
  },
];

const tools = [
  {
    title: "Post generator",
    description:
      "Draft compliant post variants quickly with tone and structure guidance.",
    href: "/tools/post-generator",
  },
  {
    title: "Subreddit analyzer",
    description:
      "Check rules, activity signals, and posting windows before committing to a subreddit.",
    href: "/tools/subreddit-analyzer",
  },
  {
    title: "Shadowban check",
    description:
      "Validate visibility signals so you can slow down early if account risk rises.",
    href: "/tools/shadowban-check",
  },
];

export default function HomePage() {
  return (
    <div>
      <AnalyticsBeacon
        eventName="homepage_view"
        source="web_public"
        onceKey="public_homepage_view"
      />
      <section className="relative pb-20 pt-16">
        <MaxWidth>
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Safety + quality + speed
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Grow on Reddit without gambling your account.
              </h1>
              <p className="mt-6 text-base text-muted-foreground sm:text-lg">
                ReditFast helps founders ship useful Reddit content with lower
                ban risk: subreddit fit, safer drafts, approval-first
                scheduling, and feedback loops.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Start free
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-border px-7 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/40"
                >
                  View plans
                </Link>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroSignals.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm font-semibold"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-8 top-6 h-44 w-44 rounded-[40px] bg-secondary/70 blur-xl" />
              <div className="absolute -right-6 bottom-2 h-40 w-40 rounded-full bg-primary/20 blur-xl" />
              <div className="relative rounded-[32px] border border-border bg-card/90 p-6 shadow-xl animate-fade-up">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Operator dashboard
                </p>
                <div className="mt-4 space-y-4">
                  {proofCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-2xl border border-border bg-background px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{card.label}</p>
                        <p className="text-sm font-semibold text-foreground/80">
                          {card.value}
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {card.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </MaxWidth>
      </section>

      <section className="py-16">
        <MaxWidth>
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-[28px] border border-border bg-card/80 p-6 shadow-sm ${
                  index === 0
                    ? "animate-fade-up"
                    : index === 1
                      ? "animate-fade-up-delay-1"
                      : "animate-fade-up-delay-2"
                }`}
              >
                <p className="text-lg font-semibold">{item.title}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </MaxWidth>
      </section>

      <section className="py-16">
        <MaxWidth>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                One operating loop from idea to measured outcome.
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                The product is built for durable systems, not one-off viral
                attempts. Every task is planned, reviewed, and measured.
              </p>
            </div>
            <div className="grid gap-4">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className={`rounded-[24px] border border-border bg-background/80 px-6 py-5 ${
                    index === 0
                      ? "animate-fade-up"
                      : index === 1
                        ? "animate-fade-up-delay-1"
                        : "animate-fade-up-delay-2"
                  }`}
                >
                  <p className="text-sm font-semibold text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{step.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </MaxWidth>
      </section>

      <section className="py-16">
        <MaxWidth>
          <div className="rounded-[32px] border border-border bg-card/75 p-8 sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Product surface
                </p>
                <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                  Everything needed for a practical Reddit growth stack.
                </h2>
              </div>
              <Link
                href="/signup"
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold transition hover:border-foreground/40"
              >
                Start activation flow
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {featureGrid.map((item, index) => (
                <div
                  key={item.title}
                  className={`rounded-2xl border border-border bg-background/80 p-5 ${
                    index === 0
                      ? "animate-fade-up"
                      : index === 1
                        ? "animate-fade-up-delay-1"
                        : index === 2
                          ? "animate-fade-up-delay-2"
                          : "animate-fade-up-delay-3"
                  }`}
                >
                  <p className="text-base font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </MaxWidth>
      </section>

      <section className="py-16">
        <MaxWidth>
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Free tools
              </p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                Try core value before signup.
              </h2>
            </div>
            <Link
              href="/tools/post-generator"
              className="hidden rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/40 md:inline-flex"
            >
              View all tools
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {tools.map((tool, index) => (
              <Link
                key={tool.title}
                href={tool.href}
                className={`group rounded-[28px] border border-border bg-card/80 p-6 transition hover:-translate-y-1 hover:border-foreground/40 ${
                  index === 0
                    ? "animate-fade-up"
                    : index === 1
                      ? "animate-fade-up-delay-1"
                      : "animate-fade-up-delay-2"
                }`}
              >
                <p className="text-lg font-semibold">{tool.title}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {tool.description}
                </p>
                <p className="mt-6 text-sm font-semibold text-foreground">
                  Open tool
                </p>
              </Link>
            ))}
          </div>
        </MaxWidth>
      </section>

      <section className="py-20">
        <MaxWidth>
          <div className="rounded-[32px] border border-border bg-primary/10 p-10 text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Ready for safer Reddit growth with less guesswork?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
              Start with free tools, then move into the guided 3-step activation
              flow and your first full execution cycle.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Start free
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/40"
              >
                View pricing
              </Link>
            </div>
          </div>
        </MaxWidth>
      </section>
    </div>
  );
}
