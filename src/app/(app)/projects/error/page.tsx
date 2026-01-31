import Link from "next/link";

export default function ProjectsErrorPreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Projects
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a preview of an error state. In production we will show the
          API error message and a request id.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-8">
        <p className="text-sm font-semibold">Unable to load projects</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please retry. If this keeps happening, contact support.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
          <Link
            href="/seo/guides/support"
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
