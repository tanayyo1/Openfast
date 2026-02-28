import Link from "next/link";
import { MaxWidth } from "@/components/public/MaxWidth";

export function HeroSection() {
  return (
    <section className="relative pb-20 pt-16">
      <MaxWidth>
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Safety + quality + speed
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Find Viral Reddit Content in Minutes, Not Hours.
            </h1>
            <p className="mt-6 text-base text-muted-foreground sm:text-lg">
              Discover trending posts, analyze subreddit rules, and get
              AI-generated drafts ready for approval—all in one platform. Lower
              your ban risk while scaling your Reddit growth.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Start Free
              </Link>
              <Link
                href="#workflow"
                className="rounded-full border border-border px-7 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/40"
              >
                See How It Works
              </Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm font-semibold">
                10,000+ Posts Discovered
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm font-semibold">
                80% Time Saved
              </div>
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm font-semibold">
                Lower Ban Risk
              </div>
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
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Viral Posts Found</p>
                    <p className="text-sm font-semibold text-foreground/80">
                      247
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Trending content discovered this week
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Time Saved</p>
                    <p className="text-sm font-semibold text-foreground/80">
                      12h
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Manual research eliminated
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Risk Score</p>
                    <p className="text-sm font-semibold text-foreground/80">
                      12/100
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Drafts checked against subreddit rules
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MaxWidth>
    </section>
  );
}
