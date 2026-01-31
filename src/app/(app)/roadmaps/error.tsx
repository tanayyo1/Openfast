'use client'

import type { ReactNode } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): ReactNode {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
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
