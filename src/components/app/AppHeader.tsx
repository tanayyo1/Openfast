import Link from "next/link";

const workspaces = ["ReditFast HQ", "Indie Studio", "Agency Lab"];

export function AppHeader() {
  return (
    <header className="border-b border-border bg-background/80 px-6 py-4 backdrop-blur sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </p>
          <div className="mt-1 flex items-center gap-2">
            <select className="rounded-full border border-border bg-background px-3 py-2 text-sm font-semibold">
              {workspaces.map((workspace) => (
                <option key={workspace}>{workspace}</option>
              ))}
            </select>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              Pro plan
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search projects, tasks, or drafts"
            className="w-64 max-w-full rounded-full border border-border bg-background px-4 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              Notifications
            </button>
            <Link
              href="/settings"
              className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
