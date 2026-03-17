import Link from "next/link";
import { MaxWidth } from "./MaxWidth";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Post generator", href: "/tools/post-generator" },
      { label: "Subreddit analyzer", href: "/tools/subreddit-analyzer" },
      { label: "Shadowban check", href: "/tools/shadowban-check" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/seo/guides/getting-started" },
      { label: "Alternatives", href: "/seo/alternatives/mediafast" },
      { label: "Guides", href: "/seo/guides/reddit-marketing" },
      { label: "Support", href: "/seo/guides/support" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Trust center", href: "/trust-center" },
      { label: "SEO hub", href: "/seo/industry/saas" },
      { label: "Industry", href: "/seo/industry/indie-founders" },
      { label: "City", href: "/seo/city/san-francisco" },
      { label: "Security", href: "/seo/guides/security" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <MaxWidth className="py-12">
        <div className="grid gap-10 md:grid-cols-[1.3fr_2fr]">
          <div>
            <p className="text-lg font-semibold">Openfast</p>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Free tools and a full workflow to help founders grow on Reddit
              without getting shadowbanned or filtered.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Copyright 2026 Openfast. All rights reserved.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {footerSections.map((section) => (
              <div key={section.title}>
                <p className="text-sm font-semibold text-foreground">
                  {section.title}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="transition hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </MaxWidth>
    </footer>
  );
}
