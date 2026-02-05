import type { ReactNode } from "react";
import Link from "next/link";

export default function NotFound(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="max-w-md text-center text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Go home
      </Link>
    </div>
  );
}
