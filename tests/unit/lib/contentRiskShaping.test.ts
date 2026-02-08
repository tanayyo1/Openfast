import { assessRisk, buildDraftVariants } from "@/lib/content/generator";

describe("content risk shaping", () => {
  test("assessRisk increases risk for promo+links against strict rules", () => {
    const risk = assessRisk(
      "Buy now and sign up",
      "Act now. https://example.com",
      "No links and no self-promo",
    );

    expect(risk.riskScore).toBeGreaterThan(50);
    expect(risk.riskReasons.length).toBeGreaterThan(0);
    expect(risk.suggestedFixes.length).toBeGreaterThan(0);
  });

  test("buildDraftVariants creates at least 3 variants and respects mode", () => {
    const generated = buildDraftVariants(
      {
        mode: "GENERATE",
        baseTitle: null,
        baseBody: "Base",
        taskTitle: "Task title",
        taskInstructions: "Share a lesson learned",
        projectName: "ReditFast",
        brandVoice: { tone: "professional" },
        subredditName: "startups",
        subredditRulesText: "No links",
        variantCount: 2,
      },
      "medium",
    );

    const rewritten = buildDraftVariants(
      {
        mode: "REWRITE",
        baseTitle: "Old title",
        baseBody: "Old body",
        taskTitle: "Task title",
        taskInstructions: "Share a lesson learned",
        projectName: "ReditFast",
        brandVoice: { tone: "friendly" },
        subredditName: "startups",
        subredditRulesText: null,
        variantCount: 3,
      },
      "short",
    );

    expect(generated.variants.length).toBeGreaterThanOrEqual(3);
    expect(generated.primary.body).toContain("Generated for");
    expect(rewritten.primary.body).toContain("Rewritten with");
  });
});
