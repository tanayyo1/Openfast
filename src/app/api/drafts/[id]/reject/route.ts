import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const rejectSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }

  const parsed = rejectSchema.safeParse(json);
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

  if (draft.status !== "REVIEWING") {
    return NextResponse.json(
      { error: "Only drafts in review can be rejected", code: "INVALID_STATE" },
      { status: 409 },
    );
  }

  const updated = await prisma.draft.update({
    where: { id },
    data: {
      status: "REJECTED",
      suggestedFixes: parsed.data.reason
        ? { reviewerNote: parsed.data.reason }
        : undefined,
      approvedAt: null,
      approvedBy: null,
    },
    select: { id: true, status: true, updatedAt: true },
  });

  return NextResponse.json({ draft: updated });
}
