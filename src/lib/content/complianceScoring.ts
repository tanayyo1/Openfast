import type { PostStructureResult } from "@/lib/content/postStructureValidator";

export type ComplianceComputation = {
  finalRiskScore: number;
  complianceScore: number;
  structurePenalty: number;
  valuePenalty: number;
  gradePenalty: number;
  warningPenalty: number;
};

export type ValueCheckResult = {
  valueScore: number;
  penalty: number;
  reasons: string[];
  fixes: Array<{ issue: string; fix: string }>;
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
  valuePenalty?: number;
}): ComplianceComputation {
  const gradeAdj = gradePenalty(input.structure.grade);
  const warningsAdj = warningPenalty(input.structure.warnings);
  const valuePenalty = Math.max(0, Math.min(30, input.valuePenalty ?? 0));
  const structurePenalty = gradeAdj + warningsAdj;
  const finalRiskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(input.baseRiskScore + structurePenalty + valuePenalty),
    ),
  );
  const complianceScore = Math.max(0, Math.min(100, 100 - finalRiskScore));

  return {
    finalRiskScore,
    complianceScore,
    structurePenalty,
    valuePenalty,
    gradePenalty: gradeAdj,
    warningPenalty: warningsAdj,
  };
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => {
    const matches = text.match(pattern);
    return count + (matches?.length ?? 0);
  }, 0);
}

export function evaluateValueCheck(input: {
  title: string | null;
  body: string;
}): ValueCheckResult {
  const combined = `${input.title ?? ""} ${input.body}`.trim();
  const lower = combined.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;

  const valuePatterns = [
    /\bhow\b/g,
    /\bwhy\b/g,
    /\bexample\b/g,
    /\blesson(s)?\b/g,
    /\btip(s)?\b/g,
    /\bmistake(s)?\b/g,
    /\bcase study\b/g,
    /\bwhat worked\b/g,
    /\bwe learned\b/g,
    /\bstep(s)?\b/g,
    /\b\d+(\.\d+)?%/g,
  ];
  const promoPatterns = [
    /\bbuy now\b/g,
    /\bsign up\b/g,
    /\bact now\b/g,
    /\bdm me\b/g,
    /\bmy product\b/g,
    /\bfree trial\b/g,
  ];

  const valueHits = countMatches(lower, valuePatterns);
  const promoHits = countMatches(lower, promoPatterns);

  let valueScore = 40;
  valueScore += Math.min(30, valueHits * 6);
  valueScore += Math.min(20, Math.floor(wordCount / 45) * 5);
  valueScore -= Math.min(30, promoHits * 8);
  valueScore = Math.max(0, Math.min(100, valueScore));

  const reasons: string[] = [];
  const fixes: Array<{ issue: string; fix: string }> = [];
  if (valueScore < 45) {
    reasons.push("Low value density before promotion intent");
    fixes.push({
      issue: "Insufficient value",
      fix: "Add concrete tips, lessons, or examples before mentioning product.",
    });
  }
  if (wordCount < 70) {
    reasons.push("Content is too short to provide strong standalone value");
    fixes.push({
      issue: "Too little context",
      fix: "Expand with practical context, outcomes, and one specific takeaway.",
    });
  }

  const penalty =
    valueScore >= 75 ? 0 : valueScore >= 60 ? 5 : valueScore >= 45 ? 10 : 16;
  return { valueScore, penalty, reasons, fixes };
}
