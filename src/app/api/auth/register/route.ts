import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
  workspaceName: z.string().min(1).max(80).optional(),
});

function isEmailUniqueViolation(err: unknown) {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : null;
  if (code !== "P2002") return false;
  const target =
    typeof err === "object" && err !== null && "meta" in err
      ? ((err as { meta?: { target?: unknown } }).meta?.target ?? [])
      : [];
  const fields = Array.isArray(target) ? target.map((v) => String(v)) : [];
  return fields.includes("email");
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { email, password, name, workspaceName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use", code: "EMAIL_TAKEN" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  let created: { user: { id: string; email: string; name: string | null }; workspace: { id: string; name: string } };
  try {
    created = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            name: name ?? null,
          },
          select: { id: true, email: true, name: true },
        });

        const ws = await tx.workspace.create({
          data: {
            name: workspaceName ?? "My workspace",
            ownerId: user.id,
          },
          select: { id: true, name: true },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: user.id,
            role: "OWNER",
          },
          select: { id: true },
        });

        await tx.workspaceEntitlement.create({
          data: {
            workspaceId: ws.id,
          },
          select: { id: true },
        });

        return { user, workspace: ws };
      },
    );
  } catch (err) {
    if (isEmailUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Email already in use", code: "EMAIL_TAKEN" },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json(
    {
      user: created.user,
      workspace: created.workspace,
    },
    { status: 201 },
  );
}
