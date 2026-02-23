import {
  buildPostGeneratorFallbackVariants,
  normalizePostGeneratorText,
  normalizePostGeneratorTopic,
} from "@/lib/content/postGeneratorTool";

describe("post generator fallback helpers", () => {
  test("normalizes noisy topic prefixes", () => {
    expect(normalizePostGeneratorTopic("discuss about onboarding loops.")).toBe(
      "onboarding loops",
    );
    expect(normalizePostGeneratorTopic("talk on growth experiments")).toBe(
      "growth experiments",
    );
    expect(normalizePostGeneratorTopic("about product messaging")).toBe(
      "product messaging",
    );
  });

  test("normalizes trailing punctuation from free-text fields", () => {
    expect(normalizePostGeneratorText(" openclip. ")).toBe("openclip");
    expect(normalizePostGeneratorText("founders!!!")).toBe("founders");
  });

  test("builds cleaner fallback variants from noisy input", () => {
    const generated = buildPostGeneratorFallbackVariants({
      topic: "discuss about the clipping.",
      product: "openclip.",
      audience: "founders",
      tone: "helpful",
      goal: "feedback",
      subredditName: "r/clippers",
      subredditRulesText: "No spam\nText posts only",
    });

    expect(generated.variants).toHaveLength(3);
    expect(generated.primary.title).toContain("The clipping");
    expect(generated.primary.title).not.toMatch(/discuss about/i);
    expect(generated.primary.body).toContain(
      "I'm building openclip for founders.",
    );
    expect(generated.primary.body).toContain("I'm exploring the clipping.");
  });
});
