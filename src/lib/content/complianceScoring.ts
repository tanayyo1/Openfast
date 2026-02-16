import type { PostStructureResult } from "@/lib/content/postStructureValidator";

export type ComplianceComputation = {
  finalRiskScore: number;
  complianceScore: number;
  structurePenalty: number;
  gradePenalty: number;
  warningPenalty: number;
};

function gradePenalty(grade: PostStructureResult["grade"]) {
  if (grade === "F") return 25;
  if (grade === "D") return 18;
  if (grade === "C") return 10;
  if (grade === "B") return 4;
  return 0;
}

function warningPenalty(warnings: PostStructureResult["warnings"]) {
  let penalty = 0;
  for (const warning of warnings) {
    penalty += warning.severity === "error" ? 6 : 3;
  }
  return Math.min(20, penalty);
}

export function computeComplianceFromStructure(input: {
  baseRiskScore: number;
  structure: Pick<PostStructureResult, "grade" | "warnings">;
}): ComplianceComputation {
  const gradeAdj = gradePenalty(input.structure.grade);
  const warningsAdj = warningPenalty(input.structure.warnings);
  const structurePenalty = gradeAdj + warningsAdj;
  const finalRiskScore = Math.max(
    0,
    Math.min(100, Math.round(input.baseRiskScore + structurePenalty)),
  );
  const complianceScore = Math.max(0, Math.min(100, 100 - finalRiskScore));

  return {
    finalRiskScore,
    complianceScore,
    structurePenalty,
    gradePenalty: gradeAdj,
    warningPenalty: warningsAdj,
  };
}
