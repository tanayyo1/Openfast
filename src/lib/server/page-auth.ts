import { redirect } from "next/navigation";
import {
  requireWorkspaceSession,
  type WorkspaceSession,
} from "@/lib/server/auth-guards";

const LOGIN_REDIRECT_ERRORS = new Set([
  "SUPABASE_NOT_CONFIGURED",
  "UNAUTHORIZED",
  "USER_NOT_SYNCED",
]);

export async function requireWorkspaceSessionForPage(): Promise<WorkspaceSession> {
  try {
    return await requireWorkspaceSession();
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (LOGIN_REDIRECT_ERRORS.has(code)) {
      redirect("/login");
    }
    if (code === "WORKSPACE_REQUIRED") {
      redirect("/onboarding");
    }
    throw error;
  }
}
