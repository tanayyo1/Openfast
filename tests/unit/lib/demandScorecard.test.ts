import { buildDemandScorecard } from "@/lib/recommendations/demandScorecard";

function rec(
  overrides: Partial<
    Parameters<typeof buildDemandScorecard>[0]["recommendations"][number]
  > = {},
) {
  return {
    fitScore: 0.8,
    riskScore: 0.2,
    timeWindowScore: 0.7,
    status: "SELECTED" as const,
    subreddit: {
      subscribers: 500000,
      activeUsers: 5000,
      avgCommentsPerPost: 20,
    },
    ...overrides,
  };
}

describe("buildDemandScorecard", () => {
  test("returns UNKNOWN with zero score when recommendations are empty", () => {
    const scorecard = buildDemandScorecard({
      recommendations: [],
      painPoints: [{ severityScore: 0.8, confidenceScore: 0.7, frequency: 10 }],
    });

    expect(scorecard.marketTier).toBe("UNKNOWN");
    expect(scorecard.overallDemandScore).toBe(0);
    expect(scorecard.blockers.length).toBeGreaterThan(0);
  });

  test("prefers selected recommendations over candidate fallback", () => {
    const scorecard = buildDemandScorecard({
      recommendations: [
        rec({
          status: "SELECTED",
          fitScore: 0.2,
          subreddit: {
            subscribers: 50000,
            activeUsers: 500,
            avgCommentsPerPost: 3,
          },
        }),
        rec({
          status: "CANDIDATE",
          fitScore: 1,
          subreddit: {
            subscribers: 500000,
            activeUsers: 5000,
            avgCommentsPerPost: 20,
          },
        }),
      ],
      painPoints: [{ severityScore: 0.1, confidenceScore: 0.1, frequency: 1 }],
    });

    expect(scorecard.coverage.selectedRecommendations).toBe(1);
    expect(scorecard.components.fit).toBe(20);
  });

  test("ignores dismissed recommendations when scoring", () => {
    const scorecard = buildDemandScorecard({
      recommendations: [
        rec({
          status: "DISMISSED",
          fitScore: 1,
          riskScore: 0,
          timeWindowScore: 1,
          subreddit: {
            subscribers: 500000,
            activeUsers: 5000,
            avgCommentsPerPost: 20,
          },
        }),
      ],
      painPoints: [],
    });

    expect(scorecard.marketTier).toBe("UNKNOWN");
    expect(scorecard.overallDemandScore).toBe(0);
    expect(scorecard.coverage.recommendations).toBe(0);
  });

  test("produces expected market tiers", () => {
    const high = buildDemandScorecard({
      recommendations: [rec({ fitScore: 1, riskScore: 0, timeWindowScore: 1 })],
      painPoints: [],
    });

    const medium = buildDemandScorecard({
      recommendations: [
        rec({
          fitScore: 0.8,
          riskScore: 0.3,
          timeWindowScore: 0.6,
          subreddit: {
            subscribers: 250000,
            activeUsers: 2500,
            avgCommentsPerPost: 10,
          },
        }),
      ],
      painPoints: [{ severityScore: 0.7, confidenceScore: 0.7, frequency: 4 }],
    });

    const early = buildDemandScorecard({
      recommendations: [
        rec({
          fitScore: 0.2,
          riskScore: 0.8,
          timeWindowScore: 0.2,
          subreddit: {
            subscribers: 20000,
            activeUsers: 100,
            avgCommentsPerPost: 2,
          },
        }),
      ],
      painPoints: [{ severityScore: 0.2, confidenceScore: 0.2, frequency: 1 }],
    });

    expect(high.marketTier).toBe("HIGH");
    expect(medium.marketTier).toBe("MEDIUM");
    expect(early.marketTier).toBe("EARLY");
  });

  test("does not saturate pain frequency when data has high outliers", () => {
    const scorecard = buildDemandScorecard({
      recommendations: [
        rec({ fitScore: 0.7, riskScore: 0.2, timeWindowScore: 0.6 }),
      ],
      painPoints: [
        { severityScore: 1, confidenceScore: 1, frequency: 4 },
        { severityScore: 1, confidenceScore: 1, frequency: 20 },
      ],
    });

    expect(scorecard.components.painIntensity).toBeLessThan(100);
    expect(scorecard.components.painIntensity).toBeGreaterThan(70);
  });
});
