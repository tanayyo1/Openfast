import { MaxWidth } from "@/components/public/MaxWidth";
import { Link2, Sparkles, FileText } from "lucide-react";

const steps = [
  {
    number: 1,
    icon: Link2,
    title: "Connect Your Reddit Sources",
    description:
      "Link your Reddit account and select the subreddits you want to monitor. Our encrypted token storage keeps your data safe.",
  },
  {
    number: 2,
    icon: Sparkles,
    title: "AI Analyzes Trending Content",
    description:
      "Our AI scans thousands of posts in real-time, identifying viral content, emerging trends, and engagement opportunities.",
  },
  {
    number: 3,
    icon: FileText,
    title: "Get Ready-to-Use Viral Posts",
    description:
      "Receive AI-generated drafts optimized for each subreddit, complete with compliance checks and risk scores.",
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-16">
      <MaxWidth>
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            How RedditFast Works
          </p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
            Three Simple Steps to Viral Content
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            From discovery to draft—automated in minutes, not hours.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`relative rounded-[28px] border border-border bg-card/80 p-6 ${
                index === 0
                  ? "animate-fade-up"
                  : index === 1
                    ? "animate-fade-up-delay-1"
                    : "animate-fade-up-delay-2"
              }`}
            >
              <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step.number}
              </div>
              <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/50">
                <step.icon className="h-6 w-6 text-foreground" />
              </div>
              <p className="mt-4 text-lg font-semibold">{step.title}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </MaxWidth>
    </section>
  );
}
