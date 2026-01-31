import Link from "next/link";
import { MaxWidth } from "./MaxWidth";

const navItems = [
  { label: "Pricing", href: "/pricing" },
  { label: "Tools", href: "/tools/post-generator" },
  { label: "SEO", href: "/seo/industry/saas" },
  { label: "Login", href: "/login" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <MaxWidth className="flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center text-lg font-semibold">
            RF
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">ReditFast</p>
            <p className="text-xs text-muted-foreground">
              Compliance-first Reddit growth
            </p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-full border border-border px-4 py-2 text-sm text-foreground transition hover:border-foreground/40 md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Start free
          </Link>
        </div>
      </MaxWidth>
    </header>
  );
}
