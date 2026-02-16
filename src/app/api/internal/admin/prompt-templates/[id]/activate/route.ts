import { NextResponse } from "next/server";
import {
  activatePromptTemplate,
  findPromptTemplateById,
} from "@/lib/prompts/templates";
import { requirePlatformAdminSession } from "@/lib/server/admin-guards";

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

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    await requirePlatformAdminSession();
  } catch (err) {
    return authError(err);
  }

  const id = ctx.params.id;
  const template = await findPromptTemplateById(id);
  if (!template) {
    return NextResponse.json(
      { error: "Prompt template not found", code: "PROMPT_TEMPLATE_NOT_FOUND" },
      { status: 404 },
    );
  }

  await activatePromptTemplate(template.id);

  return NextResponse.json({ ok: true, id: template.id, key: template.key });
}
