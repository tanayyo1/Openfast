'use client'

import type { ReactNode } from 'react'

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactNode {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Projects failed to load</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || 'Unknown error'}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Retry
      </button>
    </div>
  )
}
