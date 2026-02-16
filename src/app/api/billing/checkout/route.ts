import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getStripe } from "@/lib/billing/stripe";

const schema = z.object({
  plan: z.enum(["PRO", "LIFETIME"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function getPriceId(plan: "PRO" | "LIFETIME") {
  if (plan === "PRO") return process.env.STRIPE_PRICE_PRO_MONTHLY ?? null;
  return process.env.STRIPE_PRICE_LIFETIME ?? null;
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }

  const parsed = schema.safeParse(json);
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

  const priceId = getPriceId(parsed.data.plan);
  if (!priceId) {
    return NextResponse.json(
      {
        error: "Plan is not configured for checkout",
        code: "PRICE_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: {
      id: true,
      name: true,
      subscription: {
        select: {
          stripeCustomerId: true,
        },
      },
    },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found", code: "WORKSPACE_NOT_FOUND" },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  const customerId =
    workspace.subscription?.stripeCustomerId ??
    (
      await stripe.customers.create({
        name: workspace.name,
        metadata: {
          workspaceId: workspace.id,
          createdByUserId: session.user.id,
        },
      })
    ).id;

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const successUrl =
    parsed.data.successUrl ?? `${appUrl}/dashboard?billing=success`;
  const cancelUrl = parsed.data.cancelUrl ?? `${appUrl}/pricing?billing=cancel`;

  const isLifetime = parsed.data.plan === "LIFETIME";
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: isLifetime ? "payment" : "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      workspaceId: workspace.id,
      userId: session.user.id,
      plan: parsed.data.plan,
      priceId,
    },
    ...(isLifetime
      ? {}
      : {
          subscription_data: {
            metadata: {
              workspaceId: workspace.id,
              userId: session.user.id,
              plan: parsed.data.plan,
              priceId,
            },
          },
        }),
  });

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
    checkoutSessionId: checkoutSession.id,
  });
}
