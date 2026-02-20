import {
  computeWorkspaceDashboardSnapshot,
  type WorkspaceDashboardSnapshot,
} from "@/lib/analytics/dashboardSnapshot";
import { getLatestWorkspaceDailyRollup } from "@/lib/analytics/rollups";

export type WorkspaceDashboardData = WorkspaceDashboardSnapshot & {
  source: "rollup" | "live";
  generatedAt: string;
};

export async function getWorkspaceDashboardData(
  workspaceId: string,
  input?: {
    now?: Date;
    maxRollupAgeHours?: number;
  },
): Promise<WorkspaceDashboardData> {
  const now = input?.now ?? new Date();
  const maxRollupAgeHours = input?.maxRollupAgeHours ?? 36;

  const latestRollup = await getLatestWorkspaceDailyRollup(workspaceId);
  const rollupAgeMs = latestRollup
    ? now.getTime() - latestRollup.ingestedAt.getTime()
    : Number.POSITIVE_INFINITY;
  const useRollup = rollupAgeMs <= maxRollupAgeHours * 60 * 60 * 1000;

  if (latestRollup && useRollup) {
    return {
      source: "rollup",
      generatedAt: latestRollup.payload.generatedAt,
      summary: latestRollup.payload.summary,
      byProject: latestRollup.payload.byProject,
    };
  }

  const snapshot = await computeWorkspaceDashboardSnapshot(workspaceId);
  return {
    source: "live",
    generatedAt: now.toISOString(),
    summary: snapshot.summary,
    byProject: snapshot.byProject,
  };
}
