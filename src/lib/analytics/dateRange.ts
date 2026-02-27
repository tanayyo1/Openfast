export type DateRangeResult =
  | { ok: true; startDate: Date; endDate: Date }
  | { ok: false; error: string };

const PERIOD_DAYS: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

export function resolveDateRange(
  searchParams: URLSearchParams,
  now = new Date(),
): DateRangeResult {
  const period = searchParams.get("period") ?? "7d";
  const startDateStr = searchParams.get("start");
  const endDateStr = searchParams.get("end");

  if ((startDateStr && !endDateStr) || (!startDateStr && endDateStr)) {
    return { ok: false, error: "Both start and end must be provided together" };
  }

  if (startDateStr && endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      return { ok: false, error: "Invalid date range" };
    }
    return { ok: true, startDate, endDate };
  }

  const days = PERIOD_DAYS[period];
  if (!days) {
    return { ok: false, error: "period must be one of: 24h, 7d, 30d" };
  }

  return {
    ok: true,
    startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    endDate: now,
  };
}
