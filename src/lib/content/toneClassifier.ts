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

type TonePattern = {
  pattern: RegExp;
  weight: number;
};

const TONE_PATTERNS: Record<ToneLabel, TonePattern[]> = {
  professional: [
    { pattern: /\bstrategy\b/g, weight: 1.2 },
    { pattern: /\bframework\b/g, weight: 1.2 },
    { pattern: /\banalysis\b/g, weight: 1.2 },
    { pattern: /\bapproach\b/g, weight: 1.0 },
    { pattern: /\boptimi[sz]e\b/g, weight: 1.0 },
    { pattern: /\broadmap\b/g, weight: 1.1 },
    { pattern: /\bmethodology\b/g, weight: 1.2 },
  ],
  friendly: [
    { pattern: /\bthanks\b/g, weight: 1.0 },
    { pattern: /\bhappy\b/g, weight: 0.9 },
    { pattern: /\bappreciate\b/g, weight: 1.0 },
    { pattern: /\bcurious\b/g, weight: 0.9 },
    { pattern: /\bwould love\b/g, weight: 1.1 },
    { pattern: /\bhelpful\b/g, weight: 1.1 },
    { pattern: /\bfeel free\b/g, weight: 0.9 },
  ],
  casual: [
    { pattern: /\bhey\b/g, weight: 1.0 },
    { pattern: /\bgonna\b/g, weight: 1.2 },
    { pattern: /\bpretty\b/g, weight: 0.7 },
    { pattern: /\bkinda\b/g, weight: 1.1 },
    { pattern: /\blol\b/g, weight: 1.2 },
    { pattern: /\bawesome\b/g, weight: 0.7 },
  ],
  direct: [
    { pattern: /\bhere is\b/g, weight: 1.0 },
    { pattern: /\bdo this\b/g, weight: 1.3 },
    {
      pattern:
        /\bfirst(?:\s+(?:do|start|step|identify|define|focus|try)|\s*[,:\-])/g,
      weight: 1.2,
    },
    {
      pattern: /\bnext(?:\s+(?:do|step|identify|define|focus|try)|\s*[,:\-])/g,
      weight: 1.2,
    },
    { pattern: /\bavoid\b/g, weight: 0.9 },
    { pattern: /\bstart with\b/g, weight: 1.1 },
    { pattern: /\bstep\s+\d+\b/g, weight: 1.3 },
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
  helpful: "friendly",
  supportive: "friendly",
  empathetic: "friendly",
  empathic: "friendly",
  approachable: "friendly",
  casual: "casual",
  relaxed: "casual",
  informal: "casual",
  direct: "direct",
  concise: "direct",
  actionable: "direct",
  blunt: "direct",
  neutral: "neutral",
  balanced: "neutral",
};

const NEGATION_WORDS = new Set(["not", "no", "without", "less"]);
const NEGATION_FILLERS = new Set([
  "a",
  "an",
  "as",
  "be",
  "being",
  "bit",
  "more",
  "much",
  "really",
  "so",
  "too",
  "very",
]);

function countMatches(text: string, patterns: TonePattern[]) {
  return patterns.reduce((acc, pattern) => {
    const matches = text.match(pattern.pattern);
    return acc + (matches?.length ?? 0) * pattern.weight;
  }, 0);
}

function hasNegationPrefix(words: string[], toneWordIndex: number) {
  // Look back a few words to catch phrases like:
  // "not professional", "without being blunt", "not very casual".
  for (let lookback = 1; lookback <= 3; lookback += 1) {
    const negationIndex = toneWordIndex - lookback;
    if (negationIndex < 0) break;
    const candidate = words[negationIndex];
    if (!NEGATION_WORDS.has(candidate)) continue;

    let onlyFillersBetween = true;
    for (let i = negationIndex + 1; i < toneWordIndex; i += 1) {
      if (!NEGATION_FILLERS.has(words[i])) {
        onlyFillersBetween = false;
        break;
      }
    }
    if (onlyFillersBetween) return true;
  }
  return false;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeExpectedTone(
  input: string | null | undefined,
): ToneLabel {
  if (!input) return "neutral";
  const key = input.trim().toLowerCase();
  const direct = TONE_SYNONYMS[key];
  if (direct) return direct;

  const words = key.match(/[a-z]+/g) ?? [];
  if (words.length === 0) return "neutral";

  const counts: Record<ToneLabel, number> = {
    professional: 0,
    friendly: 0,
    casual: 0,
    direct: 0,
    neutral: 0,
  };
  const firstSeen: Partial<Record<ToneLabel, number>> = {};
  words.forEach((word, idx) => {
    const mapped = TONE_SYNONYMS[word];
    if (!mapped || mapped === "neutral") return;
    if (hasNegationPrefix(words, idx)) return;
    counts[mapped] += 1;
    if (firstSeen[mapped] === undefined) firstSeen[mapped] = idx;
  });

  const ranked = (Object.entries(counts) as Array<[ToneLabel, number]>)
    .filter(([tone, count]) => count > 0 && tone !== "neutral")
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aFirst = firstSeen[a[0]] ?? Number.MAX_SAFE_INTEGER;
      const bFirst = firstSeen[b[0]] ?? Number.MAX_SAFE_INTEGER;
      return aFirst - bFirst;
    });

  return ranked[0]?.[0] ?? "neutral";
}

export function classifyTone(input: {
  title: string | null;
  body: string;
}): ToneClassification {
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
  const alignmentScore = aligned
    ? detected.confidence
    : 100 - detected.confidence;

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
    expectedTone === "neutral" || aligned ? 0 : alignmentScore >= 55 ? 4 : 8;

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
