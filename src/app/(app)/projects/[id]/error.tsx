'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

export default function ProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactNode {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Project failed to load</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || 'Unknown error'}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Retry
        </button>
        <Link
          href="/projects"
          className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
        >
          Back to projects
        </Link>
      </div>
    </div>
  )
}
