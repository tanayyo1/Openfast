import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAdminSession } from "@/lib/server/admin-guards";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status =
    code === "FORBIDDEN" ? 403 : code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    await requireWorkspaceAdminSession();
  } catch (err) {
    return authError(err);
  }

  const id = ctx.params.id;
  const template = await prisma.promptTemplate.findUnique({
    where: { id },
    select: { id: true, key: true },
  });
  if (!template) {
    return NextResponse.json(
      { error: "Prompt template not found", code: "PROMPT_TEMPLATE_NOT_FOUND" },
      { status: 404 },
    );
  }

  await prisma.$transaction([
    prisma.promptTemplate.updateMany({
      where: { key: template.key, isActive: true },
      data: { isActive: false },
    }),
    prisma.promptTemplate.update({
      where: { id: template.id },
      data: { isActive: true },
    }),
  ]);

  return NextResponse.json({ ok: true, id: template.id, key: template.key });
}
