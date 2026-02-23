import Link from "next/link";
import { loadAppHeaderData } from "@/lib/appHeaderData";
import { AppMobileMenu } from "./AppMobileMenu";

export async function AppHeader() {
  const header = await loadAppHeaderData();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-6 py-4 backdrop-blur sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AppMobileMenu
            hasAdvancedAnalytics={header.hasAdvancedAnalytics}
            hasSmartFinder={header.hasSmartFinder}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </p>
            <p className="mt-1 text-sm font-semibold">{header.workspaceName}</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {header.planLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/onboarding"
            className="hidden rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-foreground sm:inline-flex"
          >
            Onboarding
          </Link>
          <Link
            href="/projects"
            className="hidden rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-foreground sm:inline-flex"
          >
            Projects
          </Link>
          <Link
            href="/seo/guides/support"
            className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
          >
            Support
          </Link>
          <Link
            href="/settings"
            className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Settings
          </Link>
        </div>
      </div>
    </header>
  );
}
