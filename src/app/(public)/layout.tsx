import type { ReactNode } from "react";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="gradient-orbit h-full w-full" />
          <div className="grid-surface h-full w-full opacity-40" />
        </div>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
