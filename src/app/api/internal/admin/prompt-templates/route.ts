import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPromptTemplate,
  listPromptTemplates,
} from "@/lib/prompts/templates";
import { requirePlatformAdminSession } from "@/lib/server/admin-guards";

const createSchema = z.object({
  key: z.string().min(2).max(120),
  title: z.string().min(2).max(160),
  body: z.string().min(10).max(20000),
  variables: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional().default(true),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status =
    code === "FORBIDDEN"
      ? 403
      : code === "PLATFORM_ADMIN_NOT_CONFIGURED"
        ? 503
        : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET(req: Request) {
  try {
    await requirePlatformAdminSession();
  } catch (err) {
    return authError(err);
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 50;

  const items = await listPromptTemplates({ key, limit });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requirePlatformAdminSession();
  } catch (err) {
    return authError(err);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = createSchema.safeParse(json);
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

  const { key, title, body, variables, isActive } = parsed.data;
  const created = await createPromptTemplate({
    key,
    title,
    body,
    variables: variables as Prisma.JsonValue | undefined,
    isActive,
    createdBy: session.user.id,
  });

  return NextResponse.json({ template: created }, { status: 201 });
}
