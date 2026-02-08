export function logWorkerEvent(
  worker: string,
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown> = {},
) {
  const line = {
    worker,
    level,
    event,
    ...payload,
  };

  if (level === "error") {
    console.error(JSON.stringify(line));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(line));
    return;
  }
  console.log(JSON.stringify(line));
}
