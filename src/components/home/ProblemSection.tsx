import { MaxWidth } from "@/components/public/MaxWidth";
import { Search, Clock, TrendingUp } from "lucide-react";

const problems = [
  {
    icon: Search,
    title: "Finding Trending Posts Takes Hours",
    description:
      "Manually scrolling through subreddits to find viral content wastes precious time that could be spent creating.",
  },
  {
    icon: Clock,
    title: "Missing Viral Opportunities",
    description:
      "By the time you discover a trending topic, the window for maximum engagement has already passed.",
  },
  {
    icon: TrendingUp,
    title: "No Subreddit Research",
    description:
      "Posting to the wrong subreddit or at the wrong time leads to low engagement or account restrictions.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-16">
      <MaxWidth>
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            The Problem
          </p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
            Stop Wasting Time on Manual Reddit Research
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Content creators spend hours daily searching for trending topics.
            Here&apos;s what&apos;s holding you back:
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className={`rounded-[28px] border border-border bg-card/80 p-6 shadow-sm ${
                index === 0
                  ? "animate-fade-up"
                  : index === 1
                    ? "animate-fade-up-delay-1"
                    : "animate-fade-up-delay-2"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <problem.icon className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-4 text-lg font-semibold">{problem.title}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </MaxWidth>
    </section>
  );
}
