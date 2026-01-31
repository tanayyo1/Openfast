"use client";

import { useRouter } from "next/navigation";
import { useDemoStore } from "@/stores/demoStore";

function clearDemoAuthCookie() {
  document.cookie = "rf_demo_auth=; Path=/; Max-Age=0";
}

export default function SettingsPage() {
  const router = useRouter();
  const resetDemo = useDemoStore((state) => state.resetDemo);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Workspace settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo settings for the MVP frontend. Backend settings will replace
          this.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Demo data</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Reset projects, roadmaps, drafts, and scheduled items.
          </p>
          <button
            type="button"
            onClick={() => resetDemo()}
            className="mt-6 rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Reset demo data
          </button>
        </div>

        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">Sign out</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Clears the demo auth cookie and returns to the login page.
          </p>
          <button
            type="button"
            onClick={() => {
              clearDemoAuthCookie();
              router.push("/login");
            }}
            className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
