import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let eventType = "unknown";
  try {
    const body = (await req.json()) as { type?: string };
    eventType = body.type ?? "unknown";
  } catch {
    // Ignore parse errors — just log and return 200.
  }

  console.warn("[stripe-webhook-deprecated]", {
    eventType,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, deprecated: true });
}
