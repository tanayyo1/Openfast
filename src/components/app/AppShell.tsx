import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <AppSidebar />
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex-1 px-6 pb-16 pt-8 sm:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
