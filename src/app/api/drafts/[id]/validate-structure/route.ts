import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { validatePostStructure } from "@/lib/content/postStructureValidator";

const bodySchema = z.object({
  title: z.string().max(300).optional().nullable(),
  body: z.string().max(50_000).optional(),
  subredditStrict: z.boolean().optional(),
  productCategory: z.string().max(100).optional(),
});

/**
 * POST /api/drafts/:id/validate-structure
 * Validates draft post structure (RED-63). Optional body overrides draft title/body.
 * Returns grade, warnings, rewrite suggestions, A/B and complementary product suggestions.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const { id } = await ctx.params;
  const draft = await prisma.draft.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, title: true, body: true },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Draft not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  let title = draft.title;
  let body = draft.body;
  let subredditStrict: boolean | undefined;
  let productCategory: string | undefined;

  let json: unknown = {};
  try {
    const rawBody = await req.text();
    json = rawBody.trim().length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
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
  if (parsed.data.title !== undefined) title = parsed.data.title;
  if (parsed.data.body !== undefined) body = parsed.data.body;
  subredditStrict = parsed.data.subredditStrict;
  productCategory = parsed.data.productCategory;

  const result = validatePostStructure(title, body, {
    subredditStrict,
    productCategory,
  });

  return NextResponse.json({
    draftId: id,
    structure: result,
  });
}
