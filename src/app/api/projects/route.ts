import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireWorkspaceSession } from '@/lib/server/auth-guards'

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

type ProjectCursor = {
  createdAt: string
  id: string
}

function encodeCursor(cursor: ProjectCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

function decodeCursor(raw: string): ProjectCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown
    const schema = z.object({ createdAt: z.string(), id: z.string() })
    const res = schema.safeParse(parsed)
    return res.success ? res.data : null
  } catch {
    return null
  }
}

const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(10_000),
  url: z.string().url().optional().nullable(),
  niche: z.string().min(1).max(120).default('general'),
  goals: z.unknown().optional(),
  brandVoice: z.unknown().optional(),
  constraints: z.unknown().optional().nullable(),
})

export async function GET(req: Request) {
  let session
  try {
    session = await requireWorkspaceSession()
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNAUTHORIZED'
    const status = code === 'WORKSPACE_REQUIRED' ? 400 : 401
    return NextResponse.json({ error: 'Unauthorized', code }, { status })
  }

  const { searchParams } = new URL(req.url)
  const parsedQuery = listQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid query params', code: 'VALIDATION_ERROR', details: parsedQuery.error.flatten() },
      { status: 400 },
    )
  }

  const { cursor, limit } = parsedQuery.data
  const decoded = cursor ? decodeCursor(cursor) : null
  if (cursor && !decoded) {
    return NextResponse.json(
      { error: 'Invalid cursor', code: 'INVALID_CURSOR' },
      { status: 400 },
    )
  }

  const items = await prisma.project.findMany({
    where: {
      workspaceId: session.workspaceId,
      status: { not: 'ARCHIVED' },
      ...(decoded
        ? {
            OR: [
              { createdAt: { lt: new Date(decoded.createdAt) } },
              { createdAt: new Date(decoded.createdAt), id: { lt: decoded.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      niche: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore
    ? encodeCursor({ createdAt: page[page.length - 1].createdAt.toISOString(), id: page[page.length - 1].id })
    : null

  return NextResponse.json({ items: page, nextCursor })
}

export async function POST(req: Request) {
  let session
  try {
    session = await requireWorkspaceSession()
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNAUTHORIZED'
    const status = code === 'WORKSPACE_REQUIRED' ? 400 : 401
    return NextResponse.json({ error: 'Unauthorized', code }, { status })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_JSON' }, { status: 400 })
  }

  const parsed = createProjectSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data
  const created = await prisma.project.create({
    data: {
      workspaceId: session.workspaceId,
      name: data.name,
      description: data.description,
      url: data.url ?? null,
      niche: data.niche,
      goals: data.goals ?? { primary: 'traffic', targets: [], kpis: [] },
      brandVoice: data.brandVoice ?? { tone: 'neutral', do: [], dont: [] },
      constraints: data.constraints ?? null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      niche: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ project: created }, { status: 201 })
}

