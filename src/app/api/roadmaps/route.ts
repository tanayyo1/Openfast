import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateProjectRecommendations } from "@/lib/recommendations/generate";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().optional(),
});

type Cursor = {
  createdAt: string;
  id: string;
};

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as unknown;
    const schema = z.object({ createdAt: z.string(), id: z.string().min(1) });
    const res = schema.safeParse(parsed);
    if (!res.success) return null;
    const createdAt = new Date(res.data.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return res.data;
  } catch {
    return null;
  }
}

const createRoadmapSchema = z.object({
  projectId: z.string().min(1),
  startDate: z.string().datetime().optional(),
  horizonDays: z.number().int().min(1).max(60).default(30),
});

export async function GET(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    const code = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
    return NextResponse.json({ error: "Unauthorized", code }, { status });
  }

  const { searchParams } = new URL(req.url);
  const parsedQuery = listQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
        code: "VALIDATION_ERROR",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { cursor, limit, projectId } = parsedQuery.data;
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (cursor && !decoded) {
    return NextResponse.json(
      { error: "Invalid cursor", code: "INVALID_CURSOR" },
      { status: 400 },
    );
  }

  const items = await prisma.roadmap.findMany({
    where: {
      workspaceId: session.workspaceId,
      ...(projectId ? { projectId } : {}),
      ...(decoded
        ? {
            OR: [
              { createdAt: { lt: new Date(decoded.createdAt) } },
              {
                createdAt: new Date(decoded.createdAt),
                id: { lt: decoded.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      projectId: true,
      version: true,
      startDate: true,
      horizonDays: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore
    ? encodeCursor({
        createdAt: page[page.length - 1].createdAt.toISOString(),
        id: page[page.length - 1].id,
      })
    : null;

  return NextResponse.json({ items: page, nextCursor });
}

export async function POST(req: Request) {
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
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = createRoadmapSchema.safeParse(json);
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

  const { projectId, startDate, horizonDays } = parsed.data;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId: session.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Project not found", code: "PROJECT_NOT_FOUND" },
      { status: 404 },
    );
  }

  // Ensure recommendation set exists; roadmap generation consumes selected/candidate recs.
  await generateProjectRecommendations({
    workspaceId: session.workspaceId,
    projectId,
  });

  const selectedRecs = await prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      status: "SELECTED",
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
    orderBy: [{ compositeScore: "desc" }, { id: "asc" }],
    take: 5,
  });

  const candidateRecs = await prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      status: "CANDIDATE",
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
    orderBy: [{ compositeScore: "desc" }, { id: "asc" }],
    take: 5,
  });

  const recommendations =
    selectedRecs.length > 0 ? selectedRecs : candidateRecs;

  const painPoints = await prisma.projectPainPoint.findMany({
    where: {
      workspaceId: session.workspaceId,
      projectId,
      status: "ACTIVE",
    },
    orderBy: [{ frequency: "desc" }, { severityScore: "desc" }],
    take: 40,
    select: {
      subredditId: true,
      phrase: true,
      frequency: true,
      severityScore: true,
    },
  });
  const painPointBySubreddit = new Map<
    string,
    Array<{ phrase: string; frequency: number; severityScore: number }>
  >();
  for (const painPoint of painPoints) {
    const list = painPointBySubreddit.get(painPoint.subredditId) ?? [];
    if (list.length < 2) {
      list.push({
        phrase: painPoint.phrase,
        frequency: painPoint.frequency,
        severityScore: painPoint.severityScore,
      });
    }
    painPointBySubreddit.set(painPoint.subredditId, list);
  }

  const created = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const roadmap = await tx.roadmap.create({
        data: {
          workspaceId: session.workspaceId,
          projectId,
          startDate: startDate ? new Date(startDate) : new Date(),
          horizonDays,
          version: 1,
          status: "ACTIVE",
          strategy: {
            approach: "recommendation_informed_mvp",
            selectedFirst: selectedRecs.length > 0,
            recommendationCount: recommendations.length,
          },
        },
        select: {
          id: true,
          projectId: true,
          startDate: true,
          horizonDays: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const tasksInput = Array.from({ length: horizonDays }).map((_, idx) => {
        const rec = recommendations[idx % Math.max(1, recommendations.length)];
        const dayIndex = idx + 1;
        const taskType: TaskType =
          dayIndex % 3 === 1
            ? "RESEARCH"
            : dayIndex % 3 === 2
              ? "COMMENT"
              : "POST";

        if (!rec) {
          return {
            workspaceId: session.workspaceId,
            roadmapId: roadmap.id,
            dayIndex,
            type: taskType,
            title: `Day ${dayIndex}`,
            instructions:
              "Build karma via useful comments, then post once approved.",
            priority: 3,
            status: "PENDING" as const,
            fitScore: null,
          };
        }

        const recReasons =
          rec.reasons && typeof rec.reasons === "object"
            ? (rec.reasons as Record<string, unknown>)
            : {};
        const reasonSummary =
          typeof recReasons.summary === "string" && recReasons.summary
            ? recReasons.summary
            : "Good fit based on project niche and subreddit activity.";
        const mappedPainPoints = painPointBySubreddit.get(rec.subredditId) ?? [];
        const painPointHint =
          mappedPainPoints.length > 0
            ? ` Pain points seen here: ${mappedPainPoints.map((item) => item.phrase).join("; ")}.`
            : "";

        const instructionPrefix =
          taskType === "RESEARCH"
            ? "Review latest subreddit rules and top posts."
            : taskType === "COMMENT"
              ? "Write 2-3 value-first comments to build credibility."
              : "Draft a post aligned with project voice and subreddit norms.";

        return {
          workspaceId: session.workspaceId,
          roadmapId: roadmap.id,
          dayIndex,
          type: taskType,
          subredditId: rec.subredditId,
          title: `${taskType} in r/${rec.subreddit.name}`,
          instructions: `${instructionPrefix}\nReason: ${reasonSummary}${painPointHint}`,
          priority: taskType === "POST" ? 4 : 3,
          fitScore: rec.fitScore,
          status: "PENDING" as const,
        };
      });

      const tasks = await tx.roadmapTask.createMany({ data: tasksInput });

      return { roadmap, tasksCreated: tasks.count };
    },
  );

  return NextResponse.json(
    { roadmap: created.roadmap, tasksCreated: created.tasksCreated },
    { status: 201 },
  );
}
