import type { PostStructureResult } from "@/lib/content/postStructureValidator";

export type ComplianceComputation = {
  finalRiskScore: number;
  complianceScore: number;
  structurePenalty: number;
  valuePenalty: number;
  antiPenalty: number;
  gradePenalty: number;
  warningPenalty: number;
};

export type ValueCheckResult = {
  valueScore: number;
  penalty: number;
  reasons: string[];
  fixes: Array<{ issue: string; fix: string }>;
};

const MAX_VALUE_PENALTY = 16;
const MAX_ANTI_PATTERN_PENALTY = 20;
const VALUE_SCORE_BASE = 40;
const VALUE_HIT_WEIGHT = 6;
const MAX_VALUE_HITS_BONUS = 30;
const WORD_BLOCK_SIZE = 45;
const WORD_BLOCK_BONUS = 5;
const MAX_WORD_BONUS = 20;
const VALUE_SIGNAL_PATTERNS: RegExp[] = [
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
  antiPenalty?: number;
}): ComplianceComputation {
  const gradeAdj = gradePenalty(input.structure.grade);
  const warningsAdj = warningPenalty(input.structure.warnings);
  const valuePenalty = Math.max(
    0,
    Math.min(MAX_VALUE_PENALTY, input.valuePenalty ?? 0),
  );
  const antiPenalty = Math.max(
    0,
    Math.min(MAX_ANTI_PATTERN_PENALTY, input.antiPenalty ?? 0),
  );
  const structurePenalty = gradeAdj + warningsAdj;
  const finalRiskScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.baseRiskScore + structurePenalty + valuePenalty + antiPenalty,
      ),
    ),
  );
  const complianceScore = Math.max(0, Math.min(100, 100 - finalRiskScore));

  return {
    finalRiskScore,
    complianceScore,
    structurePenalty,
    valuePenalty,
    antiPenalty,
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
  const valueHits = countMatches(lower, VALUE_SIGNAL_PATTERNS);

  // This score intentionally rewards educational/helpful signals only.
  // Promotional language and "too short" spam indicators are handled in assessRisk().
  let valueScore = VALUE_SCORE_BASE;
  valueScore += Math.min(MAX_VALUE_HITS_BONUS, valueHits * VALUE_HIT_WEIGHT);
  valueScore += Math.min(
    MAX_WORD_BONUS,
    Math.floor(wordCount / WORD_BLOCK_SIZE) * WORD_BLOCK_BONUS,
  );
  valueScore = Math.max(0, Math.min(100, valueScore));

  // Penalty bands: 75+ excellent (0), 60-74 good (5), 45-59 fair (10), <45 poor (16).
  const penalty =
    valueScore >= 75
      ? 0
      : valueScore >= 60
        ? 5
        : valueScore >= 45
          ? 10
          : MAX_VALUE_PENALTY;

  const reasons: string[] = [];
  const fixes: Array<{ issue: string; fix: string }> = [];
  if (penalty > 0) {
    if (valueScore < 45) {
      reasons.push("Low value density before promotion intent");
      fixes.push({
        issue: "Insufficient value",
        fix: "Add concrete tips, lessons, or examples before mentioning product.",
      });
    } else if (valueScore < 60) {
      reasons.push("Post has limited actionable detail for readers");
      fixes.push({
        issue: "Weak practical value",
        fix: "Include at least one concrete example or step-by-step takeaway.",
      });
    } else {
      reasons.push("Value signals are present but not strong yet");
      fixes.push({
        issue: "Value depth can improve",
        fix: "Add one more specific lesson, metric, or worked example.",
      });
    }
  }
  return { valueScore, penalty, reasons, fixes };
}
