import Link from "next/link";
import { MaxWidth } from "@/components/public/MaxWidth";

export function CTASection() {
  return (
    <section className="py-20">
      <MaxWidth>
        <div className="rounded-[32px] border border-border bg-primary/10 p-10 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Start Finding Viral Content Today
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            Join thousands of creators who have transformed their Reddit
            strategy. Get started in minutes with our free tools.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/40"
            >
              View Demo
            </Link>
          </div>
        </div>
      </MaxWidth>
    </section>
  );
}
