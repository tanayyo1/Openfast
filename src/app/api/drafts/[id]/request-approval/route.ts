import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const id = ctx.params.id;
  const draft = await prisma.draft.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, status: true },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (draft.status !== "DRAFT" && draft.status !== "REJECTED") {
    return NextResponse.json(
      { error: "Draft cannot be submitted for review", code: "INVALID_STATE" },
      { status: 409 },
    );
  }

  const updated = await prisma.draft.update({
    where: { id },
    data: { status: "REVIEWING" },
    select: { id: true, status: true, updatedAt: true },
  });

  return NextResponse.json({ draft: updated });
}
