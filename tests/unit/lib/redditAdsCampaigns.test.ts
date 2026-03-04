import {
  canTransitionCampaignStatus,
  decodeCampaignCursor,
  encodeCampaignCursor,
  normalizeCountryTargets,
  normalizeSubredditTargets,
  validateBudgetWindow,
  validateScheduleWindow,
} from "@/lib/redditAds/campaigns";

describe("reddit ads campaign helpers", () => {
  test("normalizes and deduplicates subreddit targets", () => {
    const targets = normalizeSubredditTargets([
      "r/startups",
      "Startups",
      "  r/SaaS  ",
      "bad subreddit",
      "12",
    ]);
    expect(targets).toEqual(["startups", "saas"]);
  });

  test("normalizes and deduplicates country targets", () => {
    const countries = normalizeCountryTargets(["us", "US", "ca", "x1", ""]);
    expect(countries).toEqual(["US", "CA"]);
  });

  test("validates budget window", () => {
    expect(
      validateBudgetWindow({
        dailyBudgetCents: 499,
        lifetimeBudgetCents: null,
      }),
    ).toEqual({
      ok: false,
      error: "dailyBudgetCents must be at least 500",
    });

    expect(
      validateBudgetWindow({
        dailyBudgetCents: 1000,
        lifetimeBudgetCents: 500,
      }),
    ).toEqual({
      ok: false,
      error:
        "lifetimeBudgetCents must be greater than or equal to dailyBudgetCents",
    });

    expect(
      validateBudgetWindow({
        dailyBudgetCents: 1000,
        lifetimeBudgetCents: 5000,
      }),
    ).toEqual({ ok: true });
  });

  test("validates schedule window", () => {
    const now = new Date("2026-02-20T00:00:00.000Z");
    const tomorrow = new Date("2026-02-21T00:00:00.000Z");

    expect(validateScheduleWindow({ startAt: now, endAt: null })).toEqual({
      ok: false,
      error: "Both startAt and endAt must be provided together",
    });

    expect(validateScheduleWindow({ startAt: tomorrow, endAt: now })).toEqual({
      ok: false,
      error: "startAt must be earlier than endAt",
    });

    expect(validateScheduleWindow({ startAt: now, endAt: tomorrow })).toEqual({
      ok: true,
    });
  });

  test("campaign status transitions are guarded", () => {
    expect(canTransitionCampaignStatus("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionCampaignStatus("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransitionCampaignStatus("PAUSED", "ACTIVE")).toBe(true);
    expect(canTransitionCampaignStatus("COMPLETED", "ARCHIVED")).toBe(true);
    expect(canTransitionCampaignStatus("ACTIVE", "DRAFT")).toBe(false);
    expect(canTransitionCampaignStatus("ARCHIVED", "ACTIVE")).toBe(false);
  });

  test("cursor encode/decode roundtrip", () => {
    const raw = {
      createdAt: "2026-02-20T00:00:00.000Z",
      id: "camp_123",
    };
    const encoded = encodeCampaignCursor(raw);
    expect(decodeCampaignCursor(encoded)).toEqual(raw);
    expect(decodeCampaignCursor("bad")).toBeNull();
  });
});
