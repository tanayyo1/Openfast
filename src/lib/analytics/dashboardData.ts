import {
  computeWorkspaceDashboardSnapshot,
  type WorkspaceDashboardSnapshot,
} from "@/lib/analytics/dashboardSnapshot";
import { getLatestWorkspaceDailyRollup } from "@/lib/analytics/rollups";
import {
  getWorkspaceDailyPerformanceTrend,
  type DailyPerformancePoint,
} from "@/lib/analytics/trends";

export type WorkspaceDashboardData = WorkspaceDashboardSnapshot & {
  source: "rollup" | "live";
  generatedAt: string;
  trend: DailyPerformancePoint[];
};

export async function getWorkspaceDashboardData(
  workspaceId: string,
  input?: {
    now?: Date;
    maxRollupAgeHours?: number;
    trendDays?: number;
  },
): Promise<WorkspaceDashboardData> {
  const now = input?.now ?? new Date();
  const maxRollupAgeHours = input?.maxRollupAgeHours ?? 36;
  const trendDays = input?.trendDays;

  const [latestRollup, trend] = await Promise.all([
    getLatestWorkspaceDailyRollup(workspaceId),
    getWorkspaceDailyPerformanceTrend(workspaceId, { now, days: trendDays }),
  ]);
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
      trend,
    };
  }

  const snapshot = await computeWorkspaceDashboardSnapshot(workspaceId);
  return {
    source: "live",
    generatedAt: now.toISOString(),
    summary: snapshot.summary,
    byProject: snapshot.byProject,
    trend,
  };
}
