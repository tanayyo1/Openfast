import { NextResponse } from "next/server";
import { getWorkspaceQueueHealthSnapshot } from "@/lib/ops/workspaceQueueHealth";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status =
    code === "WORKSPACE_REQUIRED"
      ? 400
      : code === "SUPABASE_NOT_CONFIGURED"
        ? 503
        : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function GET() {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  try {
    const health = await getWorkspaceQueueHealthSnapshot(session.workspaceId);
    return NextResponse.json({ health });
  } catch {
    return NextResponse.json(
      { error: "Failed to load queue health", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
