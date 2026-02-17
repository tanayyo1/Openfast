import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  isAllowedAnalyticsEventName,
  requiresWorkspaceContext,
} from "@/lib/analytics/events";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const analyticsEventSchema = z.object({
  eventName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(isAllowedAnalyticsEventName, {
      message:
        "eventName must be one of the defined funnel events or start with onboarding_step_",
    }),
  occurredAt: z.string().datetime().optional(),
  workspaceId: z.string().trim().min(1).max(80).optional(),
  userId: z.string().trim().min(1).max(80).optional(),
  anonymousSessionId: z.string().trim().min(1).max(128).optional(),
  source: z.enum(["web_public", "web_app", "server"]).default("web_app"),
  page: z.string().trim().min(1).max(300).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const ingestPayloadSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(100),
});

type PreparedEvent = {
  id: string;
  eventName: string;
  workspaceId: string | null;
  userId: string | null;
  anonymousSessionId: string | null;
  source: "web_public" | "web_app" | "server";
  page: string | null;
  properties: Record<string, unknown>;
  occurredAt: Date;
};

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireWorkspaceSession>> | null =
    null;

  try {
    session = await requireWorkspaceSession();
  } catch {
    session = null;
  }

  const rawJson = await req.json().catch(() => null);
  const parsed = ingestPayloadSchema.safeParse(rawJson);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analytics payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const violations: Array<{ index: number; reason: string }> = [];
  const preparedEvents: PreparedEvent[] = [];

  parsed.data.events.forEach((event, index) => {
    const workspaceId = event.workspaceId ?? session?.workspaceId ?? null;
    const userId = session?.user.id ?? event.userId ?? null;

    if (session && workspaceId && workspaceId !== session.workspaceId) {
      violations.push({
        index,
        reason: "workspaceId does not match authenticated workspace",
      });
      return;
    }

    if (session && event.userId && event.userId !== session.user.id) {
      violations.push({
        index,
        reason: "userId does not match authenticated user",
      });
      return;
    }

    if (!workspaceId && requiresWorkspaceContext(event.eventName)) {
      violations.push({
        index,
        reason:
          "workspaceId is required for onboarding and plan activation events",
      });
      return;
    }

    preparedEvents.push({
      id: randomUUID(),
      eventName: event.eventName,
      workspaceId,
      userId,
      anonymousSessionId: event.anonymousSessionId ?? null,
      source: event.source,
      page: event.page ?? null,
      properties: event.properties ?? {},
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    });
  });

  if (violations.length > 0) {
    return NextResponse.json(
      {
        error: "Event validation failed",
        violations,
      },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const event of preparedEvents) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO analytics_events (
            id,
            event_name,
            workspace_id,
            user_id,
            anonymous_session_id,
            source,
            page,
            properties,
            event_ts
          )
          VALUES (
            ${event.id},
            ${event.eventName},
            ${event.workspaceId},
            ${event.userId},
            ${event.anonymousSessionId},
            ${event.source},
            ${event.page},
            CAST(${JSON.stringify(event.properties)} AS jsonb),
            ${event.occurredAt}
          )
        `);
      }
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to ingest analytics events",
        code: err instanceof Error ? err.message : "INGEST_FAILED",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      accepted: preparedEvents.length,
      ingestedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}
