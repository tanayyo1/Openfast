import { MaxWidth } from "@/components/public/MaxWidth";
import { Quote } from "lucide-react";

const metrics = [
  {
    value: "50,000+",
    label: "Posts Discovered",
    description: "Viral content found for creators",
  },
  {
    value: "80%",
    label: "Time Saved",
    description: "Average reduction in research time",
  },
  {
    value: "3x",
    label: "Engagement Increase",
    description: "Compared to manual posting",
  },
];

const testimonials = [
  {
    name: "Alex Chen",
    role: "Founder, TechStart",
    quote:
      "RedditFast helped me discover viral topics before competitors. My posts went from 50 upvotes to 500+ in just two weeks.",
  },
  {
    name: "Sarah Miller",
    role: "Content Creator",
    quote:
      "I used to spend 3 hours daily searching Reddit. Now I have AI-generated drafts ready in 15 minutes. Game changer.",
  },
  {
    name: "James Wilson",
    role: "Indie Hacker",
    quote:
      "The risk score feature saved my account multiple times. Finally, a tool that understands Reddit's rules.",
  },
];

export function ProofSection() {
  return (
    <section className="py-16">
      <MaxWidth>
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Results
          </p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
            Results from creators using RedditFast
          </h2>
        </div>

        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`rounded-[24px] border border-border bg-card/80 p-6 text-center ${
                index === 0
                  ? "animate-fade-up"
                  : index === 1
                    ? "animate-fade-up-delay-1"
                    : "animate-fade-up-delay-2"
              }`}
            >
              <p className="text-4xl font-bold text-primary">{metric.value}</p>
              <p className="mt-2 text-lg font-semibold">{metric.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metric.description}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className={`rounded-[28px] border border-border bg-background/80 p-6 ${
                index === 0
                  ? "animate-fade-up"
                  : index === 1
                    ? "animate-fade-up-delay-1"
                    : "animate-fade-up-delay-2"
              }`}
            >
              <Quote className="h-8 w-8 text-primary/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                &quot;{testimonial.quote}&quot;
              </p>
              <div className="mt-6">
                <p className="font-semibold">{testimonial.name}</p>
                <p className="text-sm text-muted-foreground">
                  {testimonial.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </MaxWidth>
    </section>
  );
}
