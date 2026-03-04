import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";
import { getPolar } from "@/lib/billing/polar";

const schema = z.object({
  plan: z.enum(["PRO"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

function getPolarProductId() {
  return process.env.POLAR_PRODUCT_PRO ?? null;
}

function resolveAllowedOrigins() {
  const origins = new Set<string>();

  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // Ignore invalid APP_URL and rely on explicit allowed origins.
    }
  }

  const rawAllowedOrigins = process.env.BILLING_ALLOWED_REDIRECT_ORIGINS ?? "";
  for (const candidate of rawAllowedOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Ignore invalid configured origins.
    }
  }

  return origins;
}

function resolveRedirectUrl(
  input: string | undefined,
  fallback: string,
  allowedOrigins: Set<string>,
) {
  if (!input) return fallback;
  try {
    const url = new URL(input);
    if (!allowedOrigins.has(url.origin)) return null;
    return url.toString();
  } catch {
    return null;
  }
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

  const productId = getPolarProductId();
  if (!productId) {
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
      owner: { select: { email: true } },
    },
  });
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found", code: "WORKSPACE_NOT_FOUND" },
      { status: 404 },
    );
  }

  const allowedOrigins = resolveAllowedOrigins();
  if (allowedOrigins.size === 0) {
    return NextResponse.json(
      {
        error: "Billing redirect origins are not configured",
        code: "REDIRECT_ORIGINS_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }
  const appOrigin = allowedOrigins.values().next().value as string;
  const successFallback = `${appOrigin}/dashboard?billing=success`;
  const cancelFallback = `${appOrigin}/pricing?billing=cancelled`;
  const successUrl = resolveRedirectUrl(
    parsed.data.successUrl,
    successFallback,
    allowedOrigins,
  );
  if (!successUrl) {
    return NextResponse.json(
      {
        error: "Redirect URL must match application origin",
        code: "INVALID_REDIRECT_URL",
      },
      { status: 400 },
    );
  }
  const cancelUrl = resolveRedirectUrl(
    parsed.data.cancelUrl,
    cancelFallback,
    allowedOrigins,
  );
  if (!cancelUrl) {
    return NextResponse.json(
      {
        error: "Redirect URL must match application origin",
        code: "INVALID_REDIRECT_URL",
      },
      { status: 400 },
    );
  }

  let checkout;
  try {
    const polar = getPolar();
    checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: workspace.owner.email,
      successUrl,
      returnUrl: cancelUrl,
      metadata: {
        workspaceId: workspace.id,
        userId: session.user.id,
        plan: parsed.data.plan,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        code: "BILLING_PROVIDER_ERROR",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    checkoutUrl: checkout.url,
    checkoutId: checkout.id,
  });
}
