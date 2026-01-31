import Link from "next/link";
import { MaxWidth } from "@/components/public/MaxWidth";

const highlights = [
  {
    title: "Safe pacing by default",
    description:
      "Adaptive caps and rule checks reduce removals and protect account health.",
  },
  {
    title: "Best time windows",
    description:
      "Subreddit intelligence ranks posting windows so each task lands when the feed is active.",
  },
  {
    title: "Human approval first",
    description:
      "Every post waits for review, keeping your tone aligned and your team in control.",
  },
];

const steps = [
  {
    title: "Connect Reddit",
    detail:
      "Secure OAuth connection with scoped permissions and encrypted tokens.",
  },
  {
    title: "Generate the roadmap",
    detail:
      "Pick goals and get a day-by-day plan with the safest posting cadence.",
  },
  {
    title: "Publish with confidence",
    detail: "Schedule, review, and track results with realtime feedback loops.",
  },
];

const tools = [
  {
    title: "Post generator",
    description:
      "Craft Reddit-ready drafts with tone controls and structure hints.",
    href: "/tools/post-generator",
  },
  {
    title: "Subreddit analyzer",
    description: "See rules, risk signals, and best-time windows at a glance.",
    href: "/tools/subreddit-analyzer",
  },
  {
    title: "Shadowban check",
    description: "Run visibility checks and track account health trends.",
    href: "/tools/shadowban-check",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative pb-20 pt-16">
        <MaxWidth>
          <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Reddit marketing without bans
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Build steady Reddit growth with safe automation and clear
                timing.
              </h1>
              <p className="mt-6 text-base text-muted-foreground sm:text-lg">
                ReditFast blends subreddit intelligence, compliance scoring, and
                human approval so founders can scale authentic Reddit presence
                without risky shortcuts.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Start free trial
                </Link>
                <Link
                  href="/tools/post-generator"
                  className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/40"
                >
                  Try the tools
                </Link>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  "95% safer pacing",
                  "30 day roadmaps",
                  "Real-time analytics",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm font-semibold"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-6 top-8 h-44 w-44 rounded-[40px] bg-secondary/70 blur-xl" />
              <div className="absolute -right-4 bottom-6 h-32 w-32 rounded-full bg-primary/20 blur-lg" />
              <div className="relative rounded-[32px] border border-border bg-card/90 p-6 shadow-xl animate-fade-up">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Weekly pulse
                </p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-sm font-semibold">Best-time windows</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tue 9:00, Thu 13:00, Sat 10:00
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-muted">
                      <div className="h-2 w-3/4 rounded-full bg-primary" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-sm font-semibold">Risk check</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Low risk, 2 rule reminders, no promo flags
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      Healthy account pacing
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-sm font-semibold">Scheduled tasks</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      5 posts, 9 comments, 3 drafts pending review
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MaxWidth>
      </section>

      <section className="py-16">
        <MaxWidth>
          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map((item, index) => (
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
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                A workflow designed for compliance and clarity.
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Each step is built to align with subreddit rules while keeping
                your team in control of voice and timing.
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
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Free tools
              </p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                Try the toolkit before you commit.
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
              Ready to build a safer Reddit engine?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
              Start with the free tools, then move into full roadmaps,
              scheduling, and analytics once you are ready to scale.
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
