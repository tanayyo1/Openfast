"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { appNavSections, appQuickLinks, isNavItemActive } from "./navConfig";

export function AppMobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground lg:hidden"
      >
        Menu
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-full w-[85%] max-w-sm overflow-y-auto border-r border-border bg-background px-5 pb-8 pt-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
                  RF
                </div>
                <div>
                  <p className="text-sm font-semibold">ReditFast</p>
                  <p className="text-xs text-muted-foreground">Workspace nav</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Close
              </button>
            </div>

            <nav className="mt-6 space-y-5">
              {appNavSections.map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {section.title}
                  </p>
                  <div className="mt-2 space-y-2">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={
                          isNavItemActive(pathname, item.href)
                            ? "page"
                            : undefined
                        }
                        className={`block rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                          isNavItemActive(pathname, item.href)
                            ? "border-border bg-background text-foreground"
                            : "border-transparent text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Quick links
              </p>
              <div className="mt-3 space-y-2">
                {appQuickLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={
                      isNavItemActive(pathname, item.href) ? "page" : undefined
                    }
                    className={`block rounded-2xl border bg-background/70 px-3 py-2 text-sm font-semibold transition ${
                      isNavItemActive(pathname, item.href)
                        ? "border-border text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
