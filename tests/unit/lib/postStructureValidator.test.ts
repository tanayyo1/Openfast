import {
  validatePostStructure,
  GOOD_BAD_STRUCTURE_EXAMPLES,
} from "@/lib/content/postStructureValidator";

describe("post structure validator (RED-63)", () => {
  test("good structure example yields high score and no error-level warnings", () => {
    const { title, body } = GOOD_BAD_STRUCTURE_EXAMPLES.good;
    const result = validatePostStructure(title, body);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.grade).toMatch(/^[AB]$/);
    const errorWarnings = result.warnings.filter((w) => w.severity === "error");
    expect(errorWarnings).toHaveLength(0);
    expect(result.headlineAnalysis.productInHeadline).toBe(false);
  });

  test("bad structure example yields low score, product in headline, and rewrite suggestions", () => {
    const { title, body } = GOOD_BAD_STRUCTURE_EXAMPLES.bad;
    const result = validatePostStructure(title, body);
    expect(result.grade).toBe("F");
    expect(result.score).toBeLessThan(60);
    expect(result.headlineAnalysis.productInHeadline).toBe(true);
    expect(result.warnings.some((w) => w.code === "PRODUCT_IN_HEADLINE")).toBe(
      true,
    );
    expect(result.rewriteSuggestions.length).toBeGreaterThan(0);
  });

  test("grades F when product is in headline", () => {
    const result = validatePostStructure(
      "Check out our new app!",
      "We built this for you. Try it here: https://example.com",
    );
    expect(result.grade).toBe("F");
    expect(result.headlineAnalysis.productInHeadline).toBe(true);
    expect(result.warnings.some((w) => w.code === "PRODUCT_IN_HEADLINE")).toBe(
      true,
    );
  });

  test("warns when product appears in first 30% of post", () => {
    const result = validatePostStructure(
      "How I improved conversion",
      "Our product did this. Then we did that. Then more value here and here and here and here and here and here and here.",
    );
    expect(result.productMention.tooEarly).toBe(true);
    expect(result.warnings.some((w) => w.code === "PRODUCT_TOO_EARLY")).toBe(
      true,
    );
  });

  test("grades better when value comes before product and link is late", () => {
    const value =
      "We tried ten different approaches. Here is what actually moved the needle. First we fixed the funnel. Then we ran experiments. Then we saw a 2x lift.";
    const result = validatePostStructure(
      "Three things that 10x'd our conversion rate",
      `${value} We use ToolName for this now—link below if you want to try it. https://example.com`,
    );
    expect(result.grade).not.toBe("F");
    expect(result.headlineAnalysis.productInHeadline).toBe(false);
    expect(result.valueSection.percentValueBeforeProduct).toBeGreaterThan(40);
  });

  test("returns A/B headline suggestions and rewrite suggestions", () => {
    const result = validatePostStructure(
      "Bad headline",
      "Body with our product early.",
    );
    expect(result.abTestSuggestions.length).toBeGreaterThan(0);
    expect(result.rewriteSuggestions.length).toBeGreaterThanOrEqual(0);
    expect(result.goodBadExamples).toBeDefined();
    expect(result.goodBadExamples?.good).toContain("Good");
    expect(result.goodBadExamples?.bad).toContain("Bad");
  });

  test("complementary product suggestions when subredditStrict", () => {
    const result = validatePostStructure("Title", "Body.", {
      subredditStrict: true,
    });
    expect(result.complementaryProductSuggestions.length).toBeGreaterThan(0);
  });
});
