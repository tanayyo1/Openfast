const ANTI_PATTERN_KEYWORDS = [
  /buy now/g,
  /sign up/g,
  /limited time/g,
  /act now/g,
  /dm us/g,
  /book a demo/g,
  /schedule a call/g,
  /download/g,
  /install/g,
];
const SHOUTY_PATTERN = /\b[A-Z]{3,}\b/g;

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((sum, pattern) => {
    const matches = text.match(pattern);
    return sum + (matches?.length ?? 0);
  }, 0);
}

function projectTokens(input: string) {
  if (!input) return [];
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 8);
}

export type AntiPatternResult = {
  penalty: number;
  score: number;
  reasons: string[];
  fixes: Array<{ issue: string; fix: string }>;
};

export function evaluateAntiPattern(input: {
  title: string | null;
  body: string;
  projectName: string;
}): AntiPatternResult {
  const combined = `${input.title ?? ""} ${input.body}`.trim();
  const lower = combined.toLowerCase();
  const ctaHits = countMatches(lower, ANTI_PATTERN_KEYWORDS);
  const shoutyMatches = lower.match(SHOUTY_PATTERN)?.length ?? 0;
  const projectHits = projectTokens(input.projectName).reduce((count, token) => {
    return lower.includes(token) ? count + 1 : count;
  }, 0);

  const score = Math.max(0, 30 - ctaHits * 4 - shoutyMatches * 2 - projectHits);
  const penalty = score >= 20 ? 0 : score >= 10 ? 4 : 8;
  const reasons: string[] = [];
  const fixes: Array<{ issue: string; fix: string }> = [];
  if (ctaHits > 0) {
    reasons.push("CTA-heavy phrasing looks salesy");
    fixes.push({
      issue: "Avoid CTA spam",
      fix: "Focus on value before asking for a signup or demo.",
    });
  }
  if (shoutyMatches > 1) {
    reasons.push("Excessive uppercase/shouting in copy");
    fixes.push({
      issue: "Tone down shouting",
      fix: "Keep words and headings sentence-case instead of all-caps.",
    });
  }
  if (projectHits >= 3) {
    reasons.push("Repeated brand mention without added value");
    fixes.push({
      issue: "Reduce product name repetition",
      fix: "Weave the brand mention into a helpful example instead.",
    });
  }
  return { penalty, score, reasons, fixes };
}
