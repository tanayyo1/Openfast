import Link from "next/link";
import { getWorkspaceEntitlements } from "@/lib/billing/quota";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guards";
import {
  appQuickLinks,
  navSectionsForEntitlements,
} from "@/components/app/navConfig";

const RECOVERABLE_SESSION_ERRORS = new Set([
  "SUPABASE_NOT_CONFIGURED",
  "UNAUTHORIZED",
  "USER_NOT_SYNCED",
]);

function isRecoverableSessionError(err: unknown) {
  const code = err instanceof Error ? err.message : "";
  return RECOVERABLE_SESSION_ERRORS.has(code);
}

export async function AppSidebar() {
  let entitlements: Awaited<
    ReturnType<typeof getWorkspaceEntitlements>
  > | null = null;

  try {
    const session = await requireSession();
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });
    if (membership?.workspaceId) {
      entitlements = await getWorkspaceEntitlements(membership.workspaceId);
    }
  } catch (err) {
    if (!isRecoverableSessionError(err)) {
      throw err;
    }
  }

  const navItems = [
    ...navSectionsForEntitlements({
      hasAdvancedAnalytics: entitlements?.hasAdvancedAnalytics ?? false,
      hasSmartFinder: entitlements?.hasSmartFinder ?? false,
    }).flatMap((section) => section.items),
  ];

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
