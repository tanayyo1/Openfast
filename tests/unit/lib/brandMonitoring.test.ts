import {
  computeMentionUrgency,
  detectMentionMatches,
  detectMentionSentiment,
  extractBrandKeywords,
  passesMentionPrecisionGate,
} from "@/lib/brandMonitoring/monitor";

describe("brand monitoring helpers", () => {
  test("extracts deduped keywords from project name, url, and goals", () => {
    const keywords = extractBrandKeywords({
      projectName: "Acme AI",
      projectUrl: "https://www.acme.ai/pricing",
      goals: {
        primary: "Improve onboarding activation",
        targets: ["faster trial conversion", "AI onboarding insights"],
      },
    });

    expect(keywords).toContain("acme ai");
    expect(keywords).toContain("acme.ai");
    expect(keywords).toContain("acme");
    expect(keywords).toContain("ai");
    expect(keywords).toContain("onboarding");
    expect(keywords).toContain("activation");
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  test("drops pathological long phrases/tokens from keyword set", () => {
    const veryLongWord =
      "thisisaverylongkeywordtokenwithmorethanthirtycharacters";
    const veryLongPhrase =
      "this phrase is intentionally very long and should be excluded from matching";

    const keywords = extractBrandKeywords({
      projectName: "Acme",
      projectUrl: null,
      goals: {
        primary: veryLongPhrase,
        tokens: [veryLongWord],
      },
    });

    expect(keywords).toContain("acme");
    expect(keywords).not.toContain(veryLongWord);
    expect(keywords).not.toContain(veryLongPhrase);
  });

  test("matches keywords with word boundaries", () => {
    const matches = detectMentionMatches(
      "Acme onboarding is broken for new users",
      ["acme", "onboarding", "board"],
    );
    expect(matches).toEqual(expect.arrayContaining(["acme", "onboarding"]));
    expect(matches).not.toContain("board");
  });

  test("matches multi-word phrases with boundaries", () => {
    const matches = detectMentionMatches(
      "Anyone using acme onboarding flow in production?",
      ["acme onboarding", "me onboarding f"],
    );

    expect(matches).toContain("acme onboarding");
    expect(matches).not.toContain("me onboarding f");
  });

  test("detects sentiment markers", () => {
    expect(detectMentionSentiment("Why Acme onboarding is broken")).toBe(
      "NEGATIVE",
    );
    expect(detectMentionSentiment("Best Acme workflow for startups")).toBe(
      "POSITIVE",
    );
    expect(detectMentionSentiment("Acme onboarding checklist")).toBe("NEUTRAL");
  });

  test("does not classify substring false positives as negative", () => {
    expect(detectMentionSentiment("We audited tissue samples for research")).toBe(
      "NEUTRAL",
    );
  });

  test("precision gate requires anchor or multiple context matches", () => {
    expect(
      passesMentionPrecisionGate({
        matchedKeywords: ["onboarding"],
        anchorKeywords: ["acme", "acme.ai"],
      }),
    ).toBe(false);

    expect(
      passesMentionPrecisionGate({
        matchedKeywords: ["acme"],
        anchorKeywords: ["acme", "acme.ai"],
      }),
    ).toBe(true);

    expect(
      passesMentionPrecisionGate({
        matchedKeywords: ["onboarding", "activation"],
        anchorKeywords: ["acme", "acme.ai"],
      }),
    ).toBe(true);
  });

  test("scores urgency using sentiment + velocity + opportunity score", () => {
    expect(
      computeMentionUrgency({
        sentiment: "NEGATIVE",
        opportunityScore: 0.81,
        velocityScore: 0.7,
        matchCount: 2,
      }),
    ).toEqual({ urgency: "HIGH", score: 7 });

    expect(
      computeMentionUrgency({
        sentiment: "NEUTRAL",
        opportunityScore: 0.55,
        velocityScore: 0.4,
        matchCount: 1,
      }),
    ).toEqual({ urgency: "MEDIUM", score: 3 });
  });
});
