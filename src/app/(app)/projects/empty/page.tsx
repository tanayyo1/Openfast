import Link from "next/link";

export default function ProjectsEmptyPreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Projects
        </p>
        <h1 className="mt-3 text-3xl font-semibold">No projects yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first project to generate subreddit recommendations and
          roadmaps.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-8">
        <p className="text-sm font-semibold">Get started</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your product details and goals. We will suggest safe pacing tiers.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/onboarding/create-project"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create project
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}
