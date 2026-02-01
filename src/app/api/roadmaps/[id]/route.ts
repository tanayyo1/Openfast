import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceSession } from '@/lib/server/auth-guards'

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  let session
  try {
    session = await requireWorkspaceSession()
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNAUTHORIZED'
    const status = code === 'WORKSPACE_REQUIRED' ? 400 : 401
    return NextResponse.json({ error: 'Unauthorized', code }, { status })
  }

  const id = ctx.params.id
  const roadmap = await prisma.roadmap.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: {
      id: true,
      projectId: true,
      version: true,
      startDate: true,
      horizonDays: true,
      status: true,
      strategy: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!roadmap) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ roadmap })
}

