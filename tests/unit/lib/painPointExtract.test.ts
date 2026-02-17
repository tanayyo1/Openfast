import { extractPainPointCandidates } from "@/lib/painPoints/extract";

describe("pain point extractor", () => {
  test("extracts and ranks pain-point phrases from thread titles", () => {
    const extracted = extractPainPointCandidates([
      {
        redditId: "abc1",
        title: "Struggling with getting first users for my SaaS",
        score: 0.7,
        relevanceScore: 0.8,
      },
      {
        redditId: "abc2",
        title: "How do I reduce churn for early-stage SaaS?",
        score: 0.6,
        relevanceScore: 0.75,
      },
      {
        redditId: "abc3",
        title: "Need help with Reddit outreach that does not look spammy",
        score: 0.5,
        relevanceScore: 0.7,
      },
      {
        redditId: "abc4",
        title: "Struggling with getting first users for my SaaS",
        score: 0.65,
        relevanceScore: 0.82,
      },
    ]);

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0]).toEqual(
      expect.objectContaining({
        phrase: expect.any(String),
        normalizedPhrase: expect.any(String),
        severityScore: expect.any(Number),
        confidenceScore: expect.any(Number),
        frequency: expect.any(Number),
      }),
    );

    const top = extracted.find((item) =>
      item.normalizedPhrase.includes("struggling with"),
    );
    expect(top).toBeDefined();
    expect(top?.frequency).toBe(2);
    expect(top?.sampleTitles.length).toBeGreaterThan(0);
    expect(top?.sourceThreadIds.length).toBeGreaterThan(0);
  });

  test("normalizes cannot phrases without introducing split apostrophe tokens", () => {
    const extracted = extractPainPointCandidates([
      {
        redditId: "c1",
        title: "Can't find a reliable way to validate startup ideas",
        score: 0.7,
        relevanceScore: 0.8,
      },
    ]);

    const cannot = extracted.find((item) =>
      item.normalizedPhrase.startsWith("cannot "),
    );
    expect(cannot).toBeDefined();
    expect(cannot?.normalizedPhrase.includes("can t")).toBe(false);
  });
});
