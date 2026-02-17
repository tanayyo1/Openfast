type PainPointCandidate = {
  phrase: string;
  normalizedPhrase: string;
  severityScore: number;
  confidenceScore: number;
  frequency: number;
  sampleTitles: string[];
  sourceThreadIds: string[];
};

type SourceThread = {
  redditId: string;
  title: string;
  score: number;
  relevanceScore: number;
};

const MAX_PHRASE_LENGTH = 160;
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "with",
  "and",
  "or",
  "is",
  "are",
  "be",
  "this",
  "that",
  "it",
  "my",
  "our",
  "your",
  "from",
  "about",
  "how",
  "what",
]);

const PATTERNS: Array<{
  regex: RegExp;
  normalize: (match: RegExpMatchArray) => string;
}> = [
  {
    regex: /\b(?:struggling|struggle)\s+with\s+([^?.!,;]+)/i,
    normalize: (m) => `struggling with ${m[1]}`,
  },
  {
    regex: /\b(?:hard|difficult)\s+to\s+([^?.!,;]+)/i,
    normalize: (m) => `hard to ${m[1]}`,
  },
  {
    regex: /\bcan(?:not|'t)\s+([^?.!,;]+)/i,
    normalize: (m) => `cannot ${m[1]}`,
  },
  {
    regex: /\bhow\s+do\s+i\s+([^?.!,;]+)/i,
    normalize: (m) => `how do I ${m[1]}`,
  },
  {
    regex: /\bhow\s+to\s+([^?.!,;]+)/i,
    normalize: (m) => `how to ${m[1]}`,
  },
  {
    regex: /\bneed\s+help\s+with\s+([^?.!,;]+)/i,
    normalize: (m) => `need help with ${m[1]}`,
  },
  {
    regex: /\bproblem\s+with\s+([^?.!,;]+)/i,
    normalize: (m) => `problem with ${m[1]}`,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizePhrase(phrase: string) {
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPhrase(raw: string) {
  const phrase = raw.replace(/\s+/g, " ").trim().slice(0, MAX_PHRASE_LENGTH);
  return phrase;
}

function isLikelyNoise(normalized: string) {
  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 2) return true;
  const contentTokens = tokens.filter((token) => !STOPWORDS.has(token));
  return contentTokens.length < 2;
}

function scoreSeverity(input: { title: string; score: number; relevance: number }) {
  const text = input.title.toLowerCase();
  const strongSignals = [
    "struggling",
    "frustrated",
    "blocked",
    "can't",
    "cannot",
    "problem",
    "issue",
    "hard",
    "difficult",
    "stuck",
  ];
  const intensity =
    strongSignals.reduce((acc, signal) => acc + (text.includes(signal) ? 1 : 0), 0) /
    strongSignals.length;
  const voteBoost = clamp(input.score, 0, 1);
  const relevanceBoost = clamp(input.relevance, 0, 1);
  return clamp(0.35 + intensity * 0.4 + voteBoost * 0.15 + relevanceBoost * 0.1, 0, 1);
}

export function extractPainPointCandidates(threads: SourceThread[]) {
  const seenThreadIds = new Set<string>();
  const grouped = new Map<
    string,
    {
      phrase: string;
      normalizedPhrase: string;
      severitySamples: number[];
      confidenceSamples: number[];
      titles: string[];
      threadIds: string[];
      frequency: number;
    }
  >();

  for (const thread of threads) {
    if (seenThreadIds.has(thread.redditId)) continue;
    seenThreadIds.add(thread.redditId);

    const title = thread.title.trim();
    if (!title) continue;

    for (const pattern of PATTERNS) {
      const match = title.match(pattern.regex);
      if (!match) continue;

      const phrase = cleanPhrase(pattern.normalize(match));
      const normalizedPhrase = normalizePhrase(phrase);
      if (!normalizedPhrase || isLikelyNoise(normalizedPhrase)) continue;

      const severity = scoreSeverity({
        title,
        score: thread.score,
        relevance: thread.relevanceScore,
      });
      const confidence = clamp(0.45 + thread.relevanceScore * 0.4, 0, 1);

      const existing = grouped.get(normalizedPhrase);
      if (!existing) {
        grouped.set(normalizedPhrase, {
          phrase,
          normalizedPhrase,
          severitySamples: [severity],
          confidenceSamples: [confidence],
          titles: [title],
          threadIds: [thread.redditId],
          frequency: 1,
        });
        continue;
      }

      existing.severitySamples.push(severity);
      existing.confidenceSamples.push(confidence);
      existing.frequency += 1;
      if (existing.titles.length < 3) existing.titles.push(title);
      if (existing.threadIds.length < 5) existing.threadIds.push(thread.redditId);
    }
  }

  const candidates: PainPointCandidate[] = [...grouped.values()].map((entry) => {
    const severityScore =
      entry.severitySamples.reduce((a, b) => a + b, 0) / entry.severitySamples.length;
    const confidenceScore =
      entry.confidenceSamples.reduce((a, b) => a + b, 0) /
      entry.confidenceSamples.length;
    return {
      phrase: entry.phrase,
      normalizedPhrase: entry.normalizedPhrase,
      severityScore: Number(severityScore.toFixed(3)),
      confidenceScore: Number(confidenceScore.toFixed(3)),
      frequency: entry.frequency,
      sampleTitles: entry.titles,
      sourceThreadIds: entry.threadIds,
    };
  });

  return candidates.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    return b.confidenceScore - a.confidenceScore;
  });
}
