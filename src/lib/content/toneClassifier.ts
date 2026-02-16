export type ToneLabel =
  | "professional"
  | "friendly"
  | "casual"
  | "direct"
  | "neutral";

export type ToneClassification = {
  tone: ToneLabel;
  confidence: number;
  scores: Record<ToneLabel, number>;
};

export type ToneAlignmentResult = {
  expectedTone: ToneLabel;
  detectedTone: ToneLabel;
  confidence: number;
  alignmentScore: number;
  penalty: number;
  reasons: string[];
  fixes: Array<{ issue: string; fix: string }>;
};

const TONE_PATTERNS: Record<ToneLabel, RegExp[]> = {
  professional: [
    /\bstrategy\b/g,
    /\bframework\b/g,
    /\banalysis\b/g,
    /\bapproach\b/g,
    /\boptimi[sz]e\b/g,
  ],
  friendly: [
    /\bthanks\b/g,
    /\bhappy\b/g,
    /\bappreciate\b/g,
    /\bcurious\b/g,
    /\bwould love\b/g,
  ],
  casual: [
    /\bhey\b/g,
    /\bgonna\b/g,
    /\bpretty\b/g,
    /\bkinda\b/g,
    /\blol\b/g,
  ],
  direct: [
    /\bhere is\b/g,
    /\bdo this\b/g,
    /\bfirst\b/g,
    /\bnext\b/g,
    /\bavoid\b/g,
  ],
  neutral: [],
};

const TONE_SYNONYMS: Record<string, ToneLabel> = {
  professional: "professional",
  expert: "professional",
  formal: "professional",
  friendly: "friendly",
  warm: "friendly",
  conversational: "friendly",
  casual: "casual",
  relaxed: "casual",
  direct: "direct",
  concise: "direct",
  neutral: "neutral",
  balanced: "neutral",
};

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((acc, pattern) => {
    const matches = text.match(pattern);
    return acc + (matches?.length ?? 0);
  }, 0);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeExpectedTone(input: string | null | undefined): ToneLabel {
  if (!input) return "neutral";
  const key = input.trim().toLowerCase();
  return TONE_SYNONYMS[key] ?? "neutral";
}

export function classifyTone(input: { title: string | null; body: string }): ToneClassification {
  const text = `${input.title ?? ""}\n${input.body}`.toLowerCase();
  const scores = {
    professional: countMatches(text, TONE_PATTERNS.professional),
    friendly: countMatches(text, TONE_PATTERNS.friendly),
    casual: countMatches(text, TONE_PATTERNS.casual),
    direct: countMatches(text, TONE_PATTERNS.direct),
    neutral: 1,
  } satisfies Record<ToneLabel, number>;

  const ranked = (Object.entries(scores) as Array<[ToneLabel, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  const [topTone, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const confidence = clamp(
    Math.round((topScore / Math.max(topScore + secondScore, 1)) * 100),
    40,
    95,
  );
  return { tone: topTone, confidence, scores };
}

export function evaluateToneAlignment(input: {
  expectedTone: string | null | undefined;
  title: string | null;
  body: string;
}): ToneAlignmentResult {
  const expectedTone = normalizeExpectedTone(input.expectedTone);
  const detected = classifyTone({ title: input.title, body: input.body });
  const aligned = detected.tone === expectedTone;
  const alignmentScore = aligned ? detected.confidence : 100 - detected.confidence;

  const reasons: string[] = [];
  const fixes: Array<{ issue: string; fix: string }> = [];
  if (!aligned && expectedTone !== "neutral") {
    reasons.push(
      `Tone mismatch: expected ${expectedTone}, detected ${detected.tone}`,
    );
    fixes.push({
      issue: "Tone mismatch",
      fix: `Rewrite phrasing to sound more ${expectedTone} while keeping value-first structure.`,
    });
  }

  const penalty =
    expectedTone === "neutral" || aligned
      ? 0
      : alignmentScore >= 55
        ? 4
        : 8;

  return {
    expectedTone,
    detectedTone: detected.tone,
    confidence: detected.confidence,
    alignmentScore,
    penalty,
    reasons,
    fixes,
  };
}
