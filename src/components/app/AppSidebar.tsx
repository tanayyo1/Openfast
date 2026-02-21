import Link from "next/link";
import { appNavSections, appQuickLinks } from "./navConfig";

export function AppSidebar() {
  return (
    <aside className="border-r border-border bg-card/60 px-6 pb-8 pt-6">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
          RF
        </div>
        <div>
          <p className="text-base font-semibold">ReditFast</p>
          <p className="text-xs text-muted-foreground">Workspace hub</p>
        </div>
      </Link>

      <nav className="mt-10 space-y-5 text-sm">
        {appNavSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.title}
            </p>
            <div className="mt-2 space-y-2">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-muted-foreground transition hover:border-border hover:bg-background/70 hover:text-foreground"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Quick links
        </p>
        <div className="mt-3 space-y-2">
          {appQuickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
