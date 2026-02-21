import { prisma } from "@/lib/prisma";
import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

export function goalsToList(goals: unknown): string[] {
  if (Array.isArray(goals)) {
    return goals.filter((goal): goal is string => typeof goal === "string");
  }
  if (goals && typeof goals === "object") {
    const primary = (goals as Record<string, unknown>).primary;
    const targets = (goals as Record<string, unknown>).targets;
    const kpis = (goals as Record<string, unknown>).kpis;
    return [
      typeof primary === "string" ? primary : null,
      ...(Array.isArray(targets)
        ? targets.filter((goal): goal is string => typeof goal === "string")
        : []),
      ...(Array.isArray(kpis)
        ? kpis.filter((kpi): kpi is string => typeof kpi === "string")
        : []),
    ].filter((value): value is string => Boolean(value));
  }
  return [];
}

function jsonToText(value: unknown): string {
  if (value == null) return "Not set";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => jsonToText(item))
      .filter((item) => item !== "Not set");
    return items.length ? items.join(", ") : "Not set";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Not set";
    }
  }
  return "Not set";
}

export function brandVoiceToText(brandVoice: unknown): string {
  if (brandVoice && typeof brandVoice === "object") {
    const tone = (brandVoice as Record<string, unknown>).tone;
    const dos = (brandVoice as Record<string, unknown>).do;
    const donts = (brandVoice as Record<string, unknown>).dont;
    const parts = [
      typeof tone === "string" ? `Tone: ${tone}` : null,
      Array.isArray(dos) && dos.length
        ? `Do: ${dos.filter((item) => typeof item === "string").join(", ")}`
        : null,
      Array.isArray(donts) && donts.length
        ? `Dont: ${donts.filter((item) => typeof item === "string").join(", ")}`
        : null,
    ].filter((value): value is string => Boolean(value));
    if (parts.length) return parts.join(" | ");
  }
  return jsonToText(brandVoice);
}

export async function loadDashboardPageData() {
  const session = await requireWorkspaceSessionForPage();
  const workspaceId = session.workspaceId;

  const [projectCount, draftCount, pendingApprovals, scheduledCount, tasks] =
    await Promise.all([
      prisma.project.count({
        where: { workspaceId, status: { not: "ARCHIVED" } },
      }),
      prisma.draft.count({
        where: { workspaceId, status: { not: "ARCHIVED" } },
      }),
      prisma.draft.count({
        where: { workspaceId, status: "REVIEWING" },
      }),
      prisma.scheduledPost.count({
        where: {
          workspaceId,
          status: { in: ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHING"] },
        },
      }),
      prisma.roadmapTask.findMany({
        where: {
          workspaceId,
          status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] },
        },
        include: {
          subreddit: { select: { name: true } },
          roadmap: { select: { startDate: true } },
        },
        orderBy: [
          { priority: "desc" },
          { dayIndex: "asc" },
          { createdAt: "asc" },
        ],
        take: 5,
      }),
    ]);

  return { projectCount, draftCount, pendingApprovals, scheduledCount, tasks };
}

export async function loadProjectsPageData() {
  const session = await requireWorkspaceSessionForPage();
  return prisma.project.findMany({
    where: { workspaceId: session.workspaceId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      goals: true,
      status: true,
    },
  });
}

export async function loadProjectDetailPageData(projectId: string) {
  const session = await requireWorkspaceSessionForPage();
  const workspaceId = session.workspaceId;

  const [
    project,
    roadmapCount,
    pendingApprovals,
    scheduledCount,
    latestRoadmap,
  ] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, name: true, goals: true },
    }),
    prisma.roadmap.count({
      where: { projectId, workspaceId },
    }),
    prisma.draft.count({
      where: { projectId, workspaceId, status: "REVIEWING" },
    }),
    prisma.scheduledPost.count({
      where: {
        workspaceId,
        draft: { projectId },
        status: { in: ["SCHEDULED", "PENDING_APPROVAL", "PUBLISHING"] },
      },
    }),
    prisma.roadmap.findFirst({
      where: { projectId, workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, horizonDays: true, startDate: true },
    }),
  ]);

  return {
    project,
    roadmapCount,
    pendingApprovals,
    scheduledCount,
    latestRoadmap,
  };
}

export async function loadProjectSettingsPageData(projectId: string) {
  const session = await requireWorkspaceSessionForPage();
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      goals: true,
      brandVoice: true,
    },
  });
}
