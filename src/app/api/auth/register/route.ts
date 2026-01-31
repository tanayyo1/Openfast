import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
  workspaceName: z.string().min(1).max(80).optional(),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'BAD_JSON' },
      { status: 400 },
    )
  }

  const parsed = registerSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { email, password, name, workspaceName } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json(
      { error: 'Email already in use', code: 'EMAIL_TAKEN' },
      { status: 409 },
    )
  }

  const passwordHash = await hashPassword(password)

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: name ?? null,
      },
      select: { id: true, email: true, name: true },
    })

    const ws = await tx.workspace.create({
      data: {
        name: workspaceName ?? 'My workspace',
        ownerId: user.id,
      },
      select: { id: true, name: true },
    })

    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: user.id,
        role: 'OWNER',
      },
      select: { id: true },
    })

    await tx.workspaceEntitlement.create({
      data: {
        workspaceId: ws.id,
      },
      select: { id: true },
    })

    return { user, workspace: ws }
  })

  return NextResponse.json(
    {
      user: created.user,
      workspace: created.workspace,
    },
    { status: 201 },
  )
}
