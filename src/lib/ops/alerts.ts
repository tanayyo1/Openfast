type AlertLevel = "info" | "warn" | "error";

export async function emitOpsAlert(input: {
  type: string;
  level: AlertLevel;
  message: string;
  details?: Record<string, unknown>;
}) {
  const payload = {
    source: "reditfast.ops",
    ts: new Date().toISOString(),
    ...input,
  };

  // MVP baseline: structured logs + optional webhook.
  if (input.level === "error" || input.level === "warn") {
    console.warn(JSON.stringify(payload));
  } else {
    console.info(JSON.stringify(payload));
  }

  const webhook = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Do not fail user-facing request paths on alert transport errors.
  }
}
