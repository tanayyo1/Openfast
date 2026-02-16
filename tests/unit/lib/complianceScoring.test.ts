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
});
