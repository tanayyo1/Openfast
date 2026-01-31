import Link from 'next/link'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Projects', href: '/projects' },
  { label: 'Onboarding', href: '/onboarding' },
  { label: 'Roadmaps', href: '/roadmaps' },
  { label: 'Content', href: '/content' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'Scheduling', href: '/scheduling' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Opportunities', href: '/opportunities' },
  { label: 'Account health', href: '/health' },
]

const quickLinks = [
  { label: 'Support', href: '/seo/guides/support' },
  { label: 'Roadmap', href: '/seo/guides/reddit-marketing' },
]

export function AppSidebar() {
  return (
    <aside className="border-r border-border bg-card/60 px-6 pb-8 pt-6">
      <Link href="/dashboard" className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
          RF
        </div>
        <div>
          <p className="text-base font-semibold">ReditFast</p>
          <p className="text-xs text-muted-foreground">Workspace overview</p>
        </div>
      </Link>

      <nav className="mt-10 space-y-2 text-sm">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-muted-foreground transition hover:border-border hover:bg-background/70 hover:text-foreground"
          >
            <span>{item.label}</span>
            <span className="text-xs text-muted-foreground" />
          </Link>
        ))}
      </nav>

      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Quick links
        </p>
        <div className="mt-3 space-y-2">
          {quickLinks.map((item) => (
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
  )
}
