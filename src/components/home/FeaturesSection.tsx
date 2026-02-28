import { MaxWidth } from "@/components/public/MaxWidth";
import { Target, ListTree, Wand2, Bell } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Viral Post Detection",
    description:
      "AI-powered scanning identifies trending posts across subreddits in real-time.",
  },
  {
    icon: ListTree,
    title: "Subreddit Monitoring",
    description:
      "Track multiple subreddits with rule analysis and posting window alerts.",
  },
  {
    icon: Wand2,
    title: "AI Content Suggestions",
    description:
      "Generate compliant post drafts optimized for each subreddit's audience.",
  },
  {
    icon: Bell,
    title: "Trend Alerts",
    description:
      "Get notified immediately when topics in your niche start trending.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16">
      <MaxWidth>
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Features
          </p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
            Everything you need to grow on Reddit
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Powerful tools designed for creators who value safety and
            efficiency.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`rounded-[24px] border border-border bg-card/80 p-5 ${
                index === 0
                  ? "animate-fade-up"
                  : index === 1
                    ? "animate-fade-up-delay-1"
                    : index === 2
                      ? "animate-fade-up-delay-2"
                      : "animate-fade-up-delay-3"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-base font-semibold">{feature.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </MaxWidth>
    </section>
  );
}
