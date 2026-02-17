import {
  computeComplianceFromStructure,
  evaluateValueCheck,
} from "@/lib/content/complianceScoring";

describe("compliance scoring", () => {
  test("adds high structure penalty for weak grades + errors", () => {
    const out = computeComplianceFromStructure({
      baseRiskScore: 40,
      structure: {
        grade: "F",
        warnings: [
          { code: "A", message: "x", severity: "error" },
          { code: "B", message: "y", severity: "warning" },
        ],
      },
    });

    expect(out.gradePenalty).toBe(25);
    expect(out.warningPenalty).toBe(9);
    expect(out.valuePenalty).toBe(0);
    expect(out.finalRiskScore).toBe(74);
    expect(out.complianceScore).toBe(26);
  });

  test("keeps strong structure near base risk", () => {
    const out = computeComplianceFromStructure({
      baseRiskScore: 18,
      structure: {
        grade: "A",
        warnings: [],
      },
    });

    expect(out.structurePenalty).toBe(0);
    expect(out.valuePenalty).toBe(0);
    expect(out.antiPenalty).toBe(0);
    expect(out.finalRiskScore).toBe(18);
    expect(out.complianceScore).toBe(82);
  });

  test("applies value penalty when value-check is weak", () => {
    const value = evaluateValueCheck({
      title: "Buy now",
      body: "Act now. Sign up.",
    });
    expect(value.penalty).toBeGreaterThan(0);
    expect(value.reasons.length).toBeGreaterThan(0);

    const out = computeComplianceFromStructure({
      baseRiskScore: 30,
      structure: { grade: "A", warnings: [] },
      valuePenalty: value.penalty,
    });
    expect(out.valuePenalty).toBe(value.penalty);
    expect(out.finalRiskScore).toBeGreaterThan(30);
  });

  test("applies anti-pattern penalty and caps it", () => {
    const out = computeComplianceFromStructure({
      baseRiskScore: 30,
      structure: { grade: "A", warnings: [] },
      antiPenalty: 99,
    });

    expect(out.antiPenalty).toBe(20);
    expect(out.finalRiskScore).toBe(50);
    expect(out.complianceScore).toBe(50);
  });

  test("keeps penalty low for educational content with value signals", () => {
    const promotional = evaluateValueCheck({
      title: "Limited offer",
      body: "Short announcement only.",
    });
    const educational = evaluateValueCheck({
      title: "How we improved onboarding",
      body:
        "In this case study, we share the steps, lessons learned, and examples " +
        "that helped reduce churn by 12%. Here is what worked and why.",
    });

    expect(educational.valueScore).toBeGreaterThan(promotional.valueScore);
    expect(educational.penalty).toBeLessThanOrEqual(promotional.penalty);
  });

  test("handles empty title safely", () => {
    const value = evaluateValueCheck({
      title: "",
      body: "This post explains practical tips and one example teams can apply next sprint.",
    });

    expect(value.valueScore).toBeGreaterThanOrEqual(0);
    expect(value.penalty).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(value.reasons)).toBe(true);
  });
});
