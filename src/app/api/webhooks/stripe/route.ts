import { SubscriptionStatus, type Plan } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limitsForPlan } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";

function planFromMetadata(value: string | undefined): Plan {
  if (value === "PRO" || value === "LIFETIME" || value === "ENTERPRISE") {
    return value;
  }
  return "FREE";
}

function safeStatus(value: string | undefined): SubscriptionStatus {
  const fallback: SubscriptionStatus = "INCOMPLETE";
  if (!value) return fallback;
  const normalized = value.toUpperCase();
  if (
    normalized === "INCOMPLETE" ||
    normalized === "INCOMPLETE_EXPIRED" ||
    normalized === "TRIALING" ||
    normalized === "ACTIVE" ||
    normalized === "PAST_DUE" ||
    normalized === "CANCELLED" ||
    normalized === "UNPAID" ||
    normalized === "PAUSED"
  ) {
    return normalized;
  }
  return fallback;
}

async function applyWorkspacePlan(workspaceId: string, plan: Plan) {
  const limits = limitsForPlan(plan);
  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan },
    }),
    prisma.workspaceEntitlement.upsert({
      where: { workspaceId },
      update: {
        maxProjects: limits.maxProjects,
        maxRedditAccounts: limits.maxRedditAccounts,
        maxScheduledPosts: limits.maxScheduledPosts,
        maxDraftsPerMonth: limits.maxDraftsPerMonth,
        roadmapDays: limits.roadmapDays,
        hasAdvancedAnalytics: limits.hasAdvancedAnalytics,
        hasSmartFinder: limits.hasSmartFinder,
        hasTeamFeatures: limits.hasTeamFeatures,
      },
      create: {
        workspaceId,
        maxProjects: limits.maxProjects,
        maxRedditAccounts: limits.maxRedditAccounts,
        maxScheduledPosts: limits.maxScheduledPosts,
        maxDraftsPerMonth: limits.maxDraftsPerMonth,
        roadmapDays: limits.roadmapDays,
        hasAdvancedAnalytics: limits.hasAdvancedAnalytics,
        hasSmartFinder: limits.hasSmartFinder,
        hasTeamFeatures: limits.hasTeamFeatures,
      },
    }),
  ]);
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json(
      {
        error: "Stripe webhook is not configured",
        code: "STRIPE_WEBHOOK_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  const payload = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      {
        error: "Webhook signature verification failed",
        code: "BAD_SIGNATURE",
        details: { message },
      },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const workspaceId = session.metadata?.workspaceId;
    const plan = planFromMetadata(session.metadata?.plan);
    const customerId =
      typeof session.customer === "string" ? session.customer : null;
    if (workspaceId && customerId) {
      await prisma.subscription.upsert({
        where: { workspaceId },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : null,
          stripePriceId: session.metadata?.priceId ?? null,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
        create: {
          workspaceId,
          stripeCustomerId: customerId,
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : null,
          stripePriceId: session.metadata?.priceId ?? null,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      });
      await applyWorkspacePlan(workspaceId, plan);
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object;
    const workspaceId = subscription.metadata?.workspaceId;
    if (workspaceId) {
      await prisma.subscription.updateMany({
        where: { workspaceId },
        data: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price?.id ?? null,
          status: safeStatus(subscription.status),
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000,
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        },
      });
      if (event.type === "customer.subscription.deleted") {
        await applyWorkspacePlan(workspaceId, "FREE");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
