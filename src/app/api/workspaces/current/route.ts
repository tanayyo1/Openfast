import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function GET() {
  try {
    const session = await requireWorkspaceSession();
    return NextResponse.json({ workspaceId: session.workspaceId });
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }
}
