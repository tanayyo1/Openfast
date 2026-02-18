import { calculateDropoffs, type FunnelStage } from "@/lib/analytics/funnel";

describe("calculateDropoffs", () => {
  it("calculates dropoffs between consecutive stages", () => {
    const stages: FunnelStage[] = [
      {
        stage: "homepage",
        eventName: "homepage_view",
        uniqueUsers: 100,
        uniqueSessions: 100,
        totalEvents: 150,
      },
      {
        stage: "signup_started",
        eventName: "signup_started",
        uniqueUsers: 50,
        uniqueSessions: 50,
        totalEvents: 50,
      },
      {
        stage: "signup_completed",
        eventName: "signup_completed",
        uniqueUsers: 30,
        uniqueSessions: 30,
        totalEvents: 30,
      },
    ];

    const dropoffs = calculateDropoffs(stages);

    expect(dropoffs).toHaveLength(2);

    expect(dropoffs[0]).toEqual({
      fromStage: "homepage",
      toStage: "signup_started",
      fromCount: 100,
      toCount: 50,
      dropoffRate: 50,
      conversionRate: 50,
    });

    expect(dropoffs[1]).toEqual({
      fromStage: "signup_started",
      toStage: "signup_completed",
      fromCount: 50,
      toCount: 30,
      dropoffRate: 40,
      conversionRate: 60,
    });
  });

  it("handles zero counts gracefully", () => {
    const stages: FunnelStage[] = [
      {
        stage: "homepage",
        eventName: "homepage_view",
        uniqueUsers: 0,
        uniqueSessions: 0,
        totalEvents: 0,
      },
      {
        stage: "signup_started",
        eventName: "signup_started",
        uniqueUsers: 0,
        uniqueSessions: 0,
        totalEvents: 0,
      },
    ];

    const dropoffs = calculateDropoffs(stages);

    expect(dropoffs).toHaveLength(1);
    expect(dropoffs[0].dropoffRate).toBe(0);
    expect(dropoffs[0].conversionRate).toBe(0);
  });

  it("returns empty array for single stage", () => {
    const stages: FunnelStage[] = [
      {
        stage: "homepage",
        eventName: "homepage_view",
        uniqueUsers: 100,
        uniqueSessions: 100,
        totalEvents: 100,
      },
    ];

    const dropoffs = calculateDropoffs(stages);
    expect(dropoffs).toHaveLength(0);
  });
});
