import Link from "next/link";
import { AnalyticsBeacon } from "@/components/analytics/AnalyticsBeacon";
import { MaxWidth } from "@/components/public/MaxWidth";

const tools = [
  {
    title: "Shadowban checker",
    description:
      "See if your account is healthy, suspended, or shadow-removed. Real data from Reddit.",
    href: "/tools/shadowban-check",
    cta: "Check your account",
  },
  {
    title: "Subreddit analyzer",
    description:
      "Check rules, promo policies, and activity before you commit to posting in a subreddit.",
    href: "/tools/subreddit-analyzer",
    cta: "Analyze a subreddit",
  },
  {
    title: "Post generator",
    description:
      "Generate discussion-first Reddit drafts that don't sound promotional. AI-powered, tone-aware.",
    href: "/tools/post-generator",
    cta: "Generate a draft",
  },
];

const painPoints = [
  {
    title: "Your posts get zero traction",
    detail:
      "You write a thoughtful post, hit submit, and nothing happens. No upvotes, no comments. It might be shadow-removed and you'd never know.",
  },
  {
    title: "You don't know which subreddits allow promotion",
    detail:
      "Every subreddit has different rules. Some ban links, some require flair, some auto-remove new accounts. Finding safe places to post is a guessing game.",
  },
  {
    title: "Writing non-promotional posts takes forever",
    detail:
      "You know direct promotion gets you banned. So you write discussion-first posts, but crafting something that's helpful AND mentions your product takes 30+ minutes each time.",
  },
  {
    title: "You can't tell if your account is flagged",
    detail:
      "Reddit doesn't tell you when your posts are being filtered. You keep posting into the void, burning time and credibility without realizing it.",
  },
];

const steps = [
  {
    title: "Check your account health",
    detail:
      "Run the shadowban checker to see if your profile is visible, suspended, or being filtered. Know your starting point.",
  },
  {
    title: "Find subreddits that fit",
    detail:
      "Analyze subreddits for rules, promo policies, and activity levels. Stop guessing where to post.",
  },
  {
    title: "Generate discussion-first drafts",
    detail:
      "Create posts that sound human, lead with value, and avoid the promotional patterns that trigger removals.",
  },
  {
    title: "Review before publishing",
    detail:
      "Every post goes through compliance checks and requires your approval. Nothing gets posted without you saying yes.",
  },
];

const guardrails = [
  {
    title: "Human approval required",
    detail: "Nothing posts without your explicit review and approval.",
  },
  {
    title: "Comment-first for new accounts",
    detail:
      "New accounts start with commenting, not posting. Build karma safely before scaling.",
  },
  {
    title: "Encrypted Reddit tokens",
    detail:
      "Your Reddit credentials are encrypted at rest. We never store plaintext tokens.",
  },
  {
    title: "Nothing posts without approval",
    detail:
      "Every draft requires your explicit approval before it can be scheduled or published.",
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

      <section className="relative pb-16 pt-16">
        <MaxWidth>
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Stop guessing why your Reddit posts disappear.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Check account health, subreddit fit, and promotional risk before
              you post. Generate discussion-first drafts, review every post, and
              grow on Reddit with tighter guardrails.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/tools/shadowban-check"
                className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Check your account
              </Link>
              <Link
                href="/tools/subreddit-analyzer"
                className="rounded-full border border-border px-7 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/40"
              >
                Analyze a subreddit
              </Link>
            </div>
          </div>
        </MaxWidth>
      </section>

      <section className="py-12">
        <MaxWidth>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Free tools — no signup required
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
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
                <p className="mt-6 text-sm font-semibold text-primary">
                  {tool.cta}
                </p>
              </Link>
            ))}
          </div>
        </MaxWidth>
      </section>

      <section className="py-16">
        <MaxWidth>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Why Reddit feels random
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              It's not random. There are specific reasons your posts get
              filtered, removed, or ignored. Here are the most common ones.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {painPoints.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-[24px] border border-border bg-background/80 p-6 ${
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
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.detail}
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
                How Openfast works
              </p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                Know before you post. Review before you publish.
              </h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Every step is designed to reduce risk and save time. Start with
                free tools, move into the full workflow when you're ready.
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
                        : index === 2
                          ? "animate-fade-up-delay-2"
                          : "animate-fade-up-delay-3"
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Built-in guardrails
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Safety is the default, not an add-on.
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {guardrails.map((item, index) => (
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
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </MaxWidth>
      </section>

      <section className="py-20">
        <MaxWidth>
          <div className="rounded-[32px] border border-border bg-primary/10 p-10 text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Find out what Reddit actually sees when you post.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
              Start with the free tools. Check your account, analyze a
              subreddit, and generate your first draft. Then move into the full
              workflow when you're ready.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/tools/shadowban-check"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Check your account
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
