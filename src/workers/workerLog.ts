export function logWorkerEvent(
  worker: string,
  level: "info" | "warn" | "error",
  event: string,
  details?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "test") return;

  const payload = {
    ts: new Date().toISOString(),
    worker,
    level,
    event,
    details: details ?? {},
  };

  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
}
