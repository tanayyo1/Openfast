import Link from "next/link";
import { SimpleTable } from "@/components/app/tables/SimpleTable";

type Row = {
  title: string;
  subreddit: string;
  velocity: string;
  gap: string;
  risk: string;
};

const rows: Row[] = [
  {
    title: "How do you validate pricing before launch?",
    subreddit: "r/startups",
    velocity: "Fast",
    gap: "Few helpful answers",
    risk: "Low",
  },
  {
    title: "What does your onboarding checklist look like?",
    subreddit: "r/SaaS",
    velocity: "Medium",
    gap: "Needs examples",
    risk: "Low",
  },
  {
    title: "Tooling to automate weekly reports?",
    subreddit: "r/Entrepreneur",
    velocity: "Fast",
    gap: "Open ended",
    risk: "Medium",
  },
];

export default function OpportunitiesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Smart post finder
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Comment opportunities</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Identify high-signal threads where a helpful comment can earn trust.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/health"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back to health
          </Link>
          <button
            type="button"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Refresh feed
          </button>
        </div>
      </div>

      <SimpleTable<Row>
        columns={[
          { key: "title", header: "Thread", render: (row) => row.title },
          { key: "sub", header: "Subreddit", render: (row) => row.subreddit },
          {
            key: "velocity",
            header: "Velocity",
            render: (row) => row.velocity,
          },
          { key: "gap", header: "Comment gap", render: (row) => row.gap },
          { key: "risk", header: "Risk", render: (row) => row.risk },
        ]}
        getRowKey={(row) => `${row.subreddit}-${row.title}`}
        rows={rows}
      />

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Next steps (preview)</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecting an opportunity should generate a comment draft and attach it
          to a task.
        </p>
      </div>
    </div>
  );
}
