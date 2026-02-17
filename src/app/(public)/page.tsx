"use client";

import Link from "next/link";
import { useEffect } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";
import { analytics } from "@/lib/analyticsClient";

const heroSignals = [
  "Compliance guardrails baked in",
  "Approval-first publishing flow",
  "Subreddit-aware task planning",
];

const proofCards = [
  {
    label: "Risk Score",
    value: "18 / 100",
    detail: "Draft flagged as low-risk and ready for review",
  },
  {
    label: "Best Window",
    value: "Tue 09:00",
    detail: "Highest engagement forecast in r/startups",
  },
  {
    label: "Queue Health",
    value: "98.7%",
    detail: "Publish success in last 30 days (demo baseline)",
  },
];

const pillars = [
  {
    title: "Plan with subreddit intelligence",
    description:
      "Match your product goals to subreddits using rules, activity windows, and risk signals.",
  },
  {
    title: "Write with built-in compliance context",
    description:
      "Generate variants with rule-aware prompts, then keep only drafts that pass risk checks.",
  },
  {
    title: "Ship with approval-first automation",
    description:
      "Schedule confidently with idempotent jobs and metrics feedback after publish.",
  },
];

const steps = [
  {
    title: "Create project and connect account",
    detail:
      "Set tone, goals, and constraints. Then connect Reddit via OAuth with encrypted token storage.",
  },
  {
    title: "Generate recommendations and roadmap",
    detail:
      "Pick top subreddits and receive day-by-day post/comment tasks with suggested time windows.",
  },
  {
    title: "Approve, schedule, and learn",
    detail:
      "Review every draft, schedule safely, and use analytics snapshots to improve the next cycle.",
  },
];

const featureGrid = [
  {
    title: "Workspace-scoped projects",
    body: "Run multiple growth experiments with strict isolation across teams and accounts.",
  },
  {
    title: "Draft lifecycle controls",
    body: "Move drafts from DRAFT to REVIEWING to APPROVED before they can be scheduled.",
  },
  {
    title: "Queue-backed publishing",
    body: "Use deterministic job IDs and retries to avoid duplicate publish behavior.",
  },
  {
    title: "Metrics snapshots",
    body: "Track score, comments, and post state over time for accountable iteration.",
  },
];

const tools = [
  {
    title: "Post generator",
    description:
      "Shape Reddit-ready copy quickly with structure hints and tone controls.",
    href: "/tools/post-generator",
  },
  {
    title: "Subreddit analyzer",
    description:
      "Review rules, activity profile, and timing signals before you post.",
    href: "/tools/subreddit-analyzer",
  },
  {
    title: "Shadowban check",
    description:
      "Run visibility checks and inspect account-health warning signals.",
    href: "/tools/shadowban-check",
  },
];

export default function HomePage() {
  useEffect(() => {
    void analytics.trackHomepageView();
  }, []);

  return (
    <div>
      <section className="relative pb-20 pt-16">
        <MaxWidth>
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                MediaFast-style Reddit execution engine
              </p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Build a predictable Reddit growth pipeline without losing
                authenticity.
              </h1>
              <p className="mt-6 text-base text-muted-foreground sm:text-lg">
                ReditFast gives founders a compliance-first workflow from
                discovery to scheduling: recommendations, roadmap tasks, AI
                variants, review gates, and analytics.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  Start free trial
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
                href="/dashboard"
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold transition hover:border-foreground/40"
              >
                Open app
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
                Validate your workflow before you subscribe.
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
              Ready to turn Reddit into a repeatable growth channel?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
              Start with free tools, then move into recommendations, roadmap
              tasks, approval-first scheduling, and analytics loops.
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
