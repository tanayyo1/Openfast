import { NextResponse } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { prisma } from "@/lib/prisma";
import { applyWorkspacePlan } from "@/lib/billing/entitlements";
import { planFromPolarProductId } from "@/lib/billing/polar-products";
import type { Plan, SubscriptionStatus } from "@prisma/client";

function safeStatus(value: string | undefined): SubscriptionStatus {
  if (!value) return "INCOMPLETE";
  const key = value.toLowerCase();
  const map: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELLED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    unpaid: "UNPAID",
  };
  return map[key] ?? "INCOMPLETE";
}

function isTerminalStatus(status: string): boolean {
  return (
    status === "CANCELLED" ||
    status === "UNPAID" ||
    status === "INCOMPLETE_EXPIRED"
  );
}

function currentPeriodEndFallback(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

async function resolveWorkspaceId(
  metadata: Record<string, unknown> | null | undefined,
  providerSubscriptionId: string | null | undefined,
): Promise<{
  workspaceId: string | null;
  skipped: "no_workspace_id" | "ambiguous_provider_subscription";
}> {
  const fromMeta = metadata?.workspaceId;
  if (typeof fromMeta === "string" && fromMeta) {
    return { workspaceId: fromMeta, skipped: "no_workspace_id" };
  }

  if (providerSubscriptionId) {
    const matches = await prisma.subscription.findMany({
      where: { provider: "polar", providerSubscriptionId },
      select: { workspaceId: true },
      take: 2,
    });
    if (matches.length === 1) {
      return {
        workspaceId: matches[0].workspaceId,
        skipped: "no_workspace_id",
      };
    }
    if (matches.length > 1) {
      console.error("[polar-webhook] ambiguous_provider_subscription", {
        providerSubscriptionId,
        matches: matches.length,
      });
      return {
        workspaceId: null,
        skipped: "ambiguous_provider_subscription",
      };
    }
  }
  return { workspaceId: null, skipped: "no_workspace_id" };
}

function resolvePlan(
  productId: string | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): Plan | null {
  const byProduct = planFromPolarProductId(productId);
  if (byProduct) return byProduct;

  const metaPlan = metadata?.plan;
  if (metaPlan === "PRO" || metaPlan === "ENTERPRISE") return metaPlan;

  return null;
}

export async function POST(req: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error: "Polar webhook is not configured",
        code: "POLAR_WEBHOOK_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(body, headers, secret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json(
        {
          error: "Webhook signature verification failed",
          code: "BAD_SIGNATURE",
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const data = event.data as Record<string, unknown>;
  const metadata = data.metadata as Record<string, unknown> | null | undefined;

  if (event.type === "checkout.updated") {
    if (data.status !== "succeeded") {
      return NextResponse.json({ ok: true });
    }

    const workspace = await resolveWorkspaceId(metadata, null);
    if (!workspace.workspaceId) {
      return NextResponse.json({ ok: true, skipped: workspace.skipped });
    }
    const workspaceId = workspace.workspaceId;

    const plan = resolvePlan(data.productId as string | null, metadata);
    const periodEnd = currentPeriodEndFallback();

    await prisma.subscription.upsert({
      where: { workspaceId },
      update: {
        provider: "polar",
        providerCustomerId: (data.customerId as string) ?? null,
        providerSubscriptionId: (data.subscriptionId as string) ?? null,
        providerPriceId: null,
        stripeCustomerId: null,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      create: {
        workspaceId,
        provider: "polar",
        providerCustomerId: (data.customerId as string) ?? null,
        providerSubscriptionId: (data.subscriptionId as string) ?? null,
        providerPriceId: null,
        stripeCustomerId: null,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    if (plan) {
      await applyWorkspacePlan(workspaceId, plan);
    }
    return NextResponse.json({ ok: true });
  }

  if (
    event.type === "subscription.updated" ||
    event.type === "subscription.active"
  ) {
    const workspace = await resolveWorkspaceId(
      metadata,
      data.id as string | null,
    );
    if (!workspace.workspaceId) {
      return NextResponse.json({ ok: true, skipped: workspace.skipped });
    }
    const workspaceId = workspace.workspaceId;

    const nextStatus = safeStatus(data.status as string | undefined);
    const periodStart = data.currentPeriodStart
      ? new Date(data.currentPeriodStart as string)
      : new Date();
    const periodEnd = data.currentPeriodEnd
      ? new Date(data.currentPeriodEnd as string)
      : currentPeriodEndFallback();

    const subscriptionData = {
      provider: "polar" as const,
      providerCustomerId: (data.customerId as string) ?? null,
      providerSubscriptionId: (data.id as string) ?? null,
      providerPriceId: (data.productId as string) ?? null,
      status: nextStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
    };

    await prisma.subscription.upsert({
      where: { workspaceId },
      update: subscriptionData,
      create: {
        workspaceId,
        ...subscriptionData,
        stripeCustomerId: null,
      },
    });

    if (nextStatus === "ACTIVE" || nextStatus === "TRIALING") {
      const plan = resolvePlan(data.productId as string | null, metadata);
      if (plan) {
        await applyWorkspacePlan(workspaceId, plan);
      }
    } else if (isTerminalStatus(nextStatus)) {
      await applyWorkspacePlan(workspaceId, "FREE");
    }

    return NextResponse.json({ ok: true });
  }

  if (
    event.type === "subscription.canceled" ||
    event.type === "subscription.revoked"
  ) {
    const workspace = await resolveWorkspaceId(
      metadata,
      data.id as string | null,
    );
    if (!workspace.workspaceId) {
      return NextResponse.json({ ok: true, skipped: workspace.skipped });
    }
    const workspaceId = workspace.workspaceId;

    await prisma.subscription.updateMany({
      where: { workspaceId },
      data: {
        status: "CANCELLED",
        cancelAtPeriodEnd: true,
      },
    });

    await applyWorkspacePlan(workspaceId, "FREE");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
