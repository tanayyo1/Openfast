import Link from "next/link";
import { MaxWidth } from "@/components/public/MaxWidth";

const commitments = [
  {
    title: "Human approval is mandatory",
    detail:
      "Nothing gets scheduled or published without explicit approval in the app.",
  },
  {
    title: "Workspace-scoped data isolation",
    detail:
      "Project and account operations are scoped to the active workspace to avoid cross-workspace mutation.",
  },
  {
    title: "Encrypted Reddit credentials",
    detail:
      "Reddit access and refresh tokens are encrypted at rest before persistence.",
  },
];

const controls = [
  "Comment-first guardrails for new accounts before post scheduling.",
  "Safety-tier pacing limits to reduce aggressive posting behavior.",
  "Compliance and anti-pattern detection on generated draft variants.",
  "Queue health monitoring to catch stale/overdue publish jobs early.",
];

export default function TrustCenterPage() {
  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="rounded-[32px] border border-border bg-card/80 p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Trust Center
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            Safety and reliability commitments
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Openfast is designed to reduce ban-risk behavior while keeping
            execution practical. This page summarizes the product controls that
            protect accounts, data boundaries, and publishing workflows.
          </p>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {commitments.map((item) => (
            <article
              key={item.title}
              className="rounded-[24px] border border-border bg-background/70 p-6"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.detail}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Operational safety controls</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {controls.map((control) => (
              <li key={control}>{control}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-[24px] border border-border bg-background/70 p-6">
          <p className="text-sm font-semibold">Need help or verification?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the onboarding guide for activation walkthroughs, or contact
            support for environment-specific security and compliance questions.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/seo/guides/getting-started"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Read onboarding guide
            </Link>
            <Link
              href="/seo/guides/support"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Contact support
            </Link>
          </div>
        </section>
      </MaxWidth>
    </div>
  );
}
