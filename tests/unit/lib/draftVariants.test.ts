import {
  parseDraftComplianceSnapshot,
  parseDraftVariants,
} from "@/lib/content/draftVariants";

describe("draft variant parsing", () => {
  test("uses worker risk/compliance metadata when present", () => {
    const parsed = parseDraftVariants({
      variants: [
        {
          title: "Variant A",
          body: "Body A",
          score: 0.8,
          riskScore: 67,
          riskReasons: ["Low value density before promotion intent"],
          valueScore: 42,
          complianceScore: 33,
          antiPatternFlags: ["engagement-gating"],
          expectedTone: "professional",
          detectedTone: "salesy",
        },
      ],
      fallbackRiskScore: 15,
      fallbackNotes: ["fallback note"],
      compliance: null,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      title: "Variant A",
      body: "Body A",
      riskScore: 67,
      notes: ["Low value density before promotion intent"],
      valueScore: 42,
      complianceScore: 33,
      antiPatternFlags: ["engagement-gating"],
      expectedTone: "professional",
      detectedTone: "salesy",
    });
  });

  test("supports legacy score format and fallback notes", () => {
    const parsed = parseDraftVariants({
      variants: [{ title: "Legacy", body: "Legacy body", score: 0.75 }],
      fallbackRiskScore: 40,
      fallbackNotes: ["default note"],
      compliance: null,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.riskScore).toBe(25);
    expect(parsed[0]?.notes).toEqual(["default note"]);
  });

  test("hydrates primary variant from compliance snapshot when fields are absent", () => {
    const compliance = parseDraftComplianceSnapshot({
      compliance: {
        selectedComplianceScore: 71,
        selectedValueScore: 63,
        selectedAntiPatternFlags: ["vote-manipulation"],
        selectedExpectedTone: "neutral",
        selectedDetectedTone: "promotional",
      },
    });

    const parsed = parseDraftVariants({
      variants: [{ title: "A", body: "B", score: 0.9 }],
      fallbackRiskScore: 12,
      fallbackNotes: ["fallback"],
      compliance,
      selectedTitle: "A",
      selectedBody: "B",
      selectedRiskScore: 10,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      riskScore: 10,
      complianceScore: 71,
      valueScore: 63,
      antiPatternFlags: ["vote-manipulation"],
      expectedTone: "neutral",
      detectedTone: "promotional",
    });
  });

  test("applies compliance snapshot to the selected variant even when not first", () => {
    const compliance = parseDraftComplianceSnapshot({
      compliance: {
        selectedComplianceScore: 74,
        selectedValueScore: 69,
        selectedAntiPatternFlags: ["repetition"],
        selectedExpectedTone: "neutral",
        selectedDetectedTone: "promotional",
      },
    });

    const parsed = parseDraftVariants({
      variants: [
        { title: "A", body: "Body A", score: 0.9 },
        { title: "B", body: "Body B", score: 0.7 },
      ],
      fallbackRiskScore: 30,
      fallbackNotes: ["fallback"],
      compliance,
      selectedTitle: "B",
      selectedBody: "Body B",
      selectedRiskScore: 30,
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      valueScore: null,
      complianceScore: null,
      antiPatternFlags: [],
      expectedTone: null,
      detectedTone: null,
    });
    expect(parsed[1]).toMatchObject({
      valueScore: 69,
      complianceScore: 74,
      antiPatternFlags: ["repetition"],
      expectedTone: "neutral",
      detectedTone: "promotional",
    });
  });

  test("keeps explicit empty antiPatternFlags from variant payload", () => {
    const compliance = parseDraftComplianceSnapshot({
      compliance: {
        selectedComplianceScore: 70,
        selectedValueScore: 60,
        selectedAntiPatternFlags: ["engagement-gating"],
        selectedExpectedTone: "neutral",
        selectedDetectedTone: "neutral",
      },
    });

    const parsed = parseDraftVariants({
      variants: [
        { title: "A", body: "Body A", score: 0.8, antiPatternFlags: [] },
      ],
      fallbackRiskScore: 20,
      fallbackNotes: ["fallback"],
      compliance,
      selectedTitle: "A",
      selectedBody: "Body A",
      selectedRiskScore: 20,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.antiPatternFlags).toEqual([]);
  });

  test("returns empty list for invalid variant payloads", () => {
    expect(
      parseDraftVariants({
        variants: null,
        fallbackRiskScore: 20,
        fallbackNotes: ["x"],
        compliance: null,
      }),
    ).toEqual([]);

    expect(
      parseDraftVariants({
        variants: [{ title: "missing-body" }],
        fallbackRiskScore: 20,
        fallbackNotes: ["x"],
        compliance: null,
      }),
    ).toEqual([]);
  });

  test("parses compliance snapshot safely from unknown input", () => {
    expect(parseDraftComplianceSnapshot(null)).toBeNull();
    expect(parseDraftComplianceSnapshot({})).toBeNull();

    const parsed = parseDraftComplianceSnapshot({
      compliance: {
        selectedComplianceScore: 88,
        selectedValueScore: 73,
        selectedAntiPatternFlags: ["repetition"],
        selectedExpectedTone: "professional",
        selectedDetectedTone: "neutral",
      },
    });

    expect(parsed).toEqual({
      selectedComplianceScore: 88,
      selectedValueScore: 73,
      selectedAntiPatternFlags: ["repetition"],
      selectedExpectedTone: "professional",
      selectedDetectedTone: "neutral",
    });
  });
});
