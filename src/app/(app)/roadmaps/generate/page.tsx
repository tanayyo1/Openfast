'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useDemoStore } from '@/stores/demoStore'

export default function RoadmapGeneratePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const projectIdFromQuery = searchParams.get('projectId') ?? ''

  const projects = useDemoStore((state) => state.projects)
  const accounts = useDemoStore((state) => state.redditAccounts)
  const generateRoadmap = useDemoStore((state) => state.generateRoadmap)

  const [selectedProjectId, setSelectedProjectId] = useState(
    projectIdFromQuery || projects[0]?.id || ''
  )
  const [busy, setBusy] = useState(false)

  const canGenerate = useMemo(() => {
    return Boolean(selectedProjectId) && accounts.length > 0
  }, [accounts.length, selectedProjectId])

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Roadmaps
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Generate roadmap</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Demo-only generation. Backend will compute recommendations and time windows.
        </p>
      </div>

      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="project">
              Project
            </label>
            <select
              id="project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {projects.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Create a project first.
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-sm font-semibold">Connected Reddit accounts</p>
            <div className="mt-2 rounded-2xl border border-border bg-background/70 p-4">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No accounts connected. Connect one to proceed.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      u/{account.username} ({account.tier})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            What gets created
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>3 tasks across 2-3 subreddits</li>
            <li>Best-time windows attached to each task</li>
            <li>Draft generation happens per-task</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canGenerate || busy}
            onClick={() => {
              setBusy(true)
              const roadmapId = generateRoadmap({ projectId: selectedProjectId })
              router.push(`/roadmaps/${encodeURIComponent(roadmapId)}`)
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? 'Generating' : 'Generate'}
          </button>
          <Link
            href="/roadmaps"
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  )
}
