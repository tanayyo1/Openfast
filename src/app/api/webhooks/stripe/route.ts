import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let eventType = "unknown";
  try {
    const body = (await req.json()) as { type?: string };
    eventType = body.type ?? "unknown";
  } catch {
    // Ignore parse errors; keep deprecated response behavior.
  }

  const legacyAckEnabled =
    process.env.STRIPE_WEBHOOK_LEGACY_ACK === "1" ||
    process.env.STRIPE_WEBHOOK_LEGACY_ACK === "true";

  console.warn("[stripe-webhook-deprecated]", {
    eventType,
    legacyAckEnabled,
    timestamp: new Date().toISOString(),
  });

  if (legacyAckEnabled) {
    return NextResponse.json({ ok: true, deprecated: true, accepted: false });
  }

  return NextResponse.json(
    {
      error:
        "Stripe webhook endpoint is deprecated. Configure Polar webhook endpoint instead.",
      code: "STRIPE_WEBHOOK_DEPRECATED",
      deprecated: true,
      accepted: false,
    },
    { status: 410 },
  );
}
