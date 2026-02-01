import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const id = ctx.params.id;
  const existing = await prisma.redditAccount.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // MVP: delete the connection. (Tokens are encrypted, but removal is simplest.)
  await prisma.redditAccount.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
