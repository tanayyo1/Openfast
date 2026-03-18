/**
 * AI Subreddit Rule Analyzer
 *
 * Takes raw subreddit rules + metadata and returns structured analysis:
 * - Verdict (green/yellow/red)
 * - Deal-breakers
 * - Categorized rules
 * - Posting strategy recommendations
 *
 * Uses gpt-5.2 for strong structured output at reasonable cost.
 */

import { generateChatText } from "@/lib/ai/openaiClient";

export type SubredditVerdict =
  | "PROMOTION_FRIENDLY"
  | "CAUTION"
  | "NOT_RECOMMENDED"
  | "UNKNOWN";

export type DealBreaker = {
  label: string;
  value: string;
  isBlocking: boolean;
};

export type CategorizedRule = {
  category: "promotion" | "content" | "behavior" | "moderation";
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type PostingTip = {
  do: string;
  dont: string;
};

export type SubredditAnalysis = {
  verdict: SubredditVerdict;
  verdictLabel: string;
  verdictSummary: string;
  dealBreakers: DealBreaker[];
  rules: CategorizedRule[];
  postingStrategy: {
    approach: string;
    tips: PostingTip[];
    bestContentType: string;
  };
  relatedSubreddits: string[];
};

const SYSTEM_PROMPT = `You are an expert Reddit marketing analyst. Analyze subreddit rules and metadata to help founders understand if and how they can participate in this community.

Return strict JSON matching this schema:
{
  "verdict": "PROMOTION_FRIENDLY" | "CAUTION" | "NOT_RECOMMENDED" | "UNKNOWN",
  "verdictLabel": "string (short label like 'Promotion Friendly' or 'High Risk')",
  "verdictSummary": "string (one sentence explaining the verdict)",
  "dealBreakers": [
    { "label": "string (e.g. 'Min Karma')", "value": "string (e.g. '500 required' or 'None')", "isBlocking": boolean }
  ],
  "rules": [
    { "category": "promotion|content|behavior|moderation", "title": "string (short)", "detail": "string (one sentence)", "severity": "info|warning|critical" }
  ],
  "postingStrategy": {
    "approach": "string (2-3 sentence strategy for a founder posting here)",
    "tips": [{ "do": "string", "dont": "string" }],
    "bestContentType": "string (e.g. 'Discussion posts with personal experience')"
  },
  "relatedSubreddits": ["string (3-5 similar subreddits without r/ prefix)"]
}

Rules for your analysis:
- PROMOTION_FRIENDLY: Promo explicitly allowed (even with conditions)
- CAUTION: No explicit promo rules, but self-promo is tolerated if valuable
- NOT_RECOMMENDED: Explicit no-promo policy, strict moderation, high ban risk
- UNKNOWN: Not enough information to determine
- Deal-breakers: include min karma, min account age, flair required, text-only, link restrictions. Set isBlocking=true only for actual blocking requirements.
- Rules: categorize each rule. Max 10 rules. Summarize lengthy rules into one clear sentence.
- Posting tips: 3-4 practical do/don't pairs specific to this subreddit
- Related subreddits: suggest 3-5 similar communities a founder might also consider`;

export async function analyzeSubredditRules(input: {
  subredditName: string;
  subscribers: number;
  description: string;
  rules: string[];
  isRestricted: boolean;
  isQuarantined: boolean;
  nsfw: boolean;
}): Promise<SubredditAnalysis | null> {
  const userPrompt = [
    `Subreddit: r/${input.subredditName}`,
    `Subscribers: ${input.subscribers.toLocaleString()}`,
    `Description: ${input.description.slice(0, 500)}`,
    `Restricted: ${input.isRestricted}`,
    `Quarantined: ${input.isQuarantined}`,
    `NSFW: ${input.nsfw}`,
    ``,
    `Rules (${input.rules.length} total):`,
    ...input.rules.map((r, i) => `${i + 1}. ${r.slice(0, 500)}`),
  ].join("\n");

  const raw = await generateChatText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    feature: "subreddit-analysis",
    maxTokens: 1500,
  });

  if (!raw) return null;

  // Extract JSON from response (may have markdown wrapping)
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) return null;

  try {
    const parsed = JSON.parse(
      raw.slice(jsonStart, jsonEnd + 1),
    ) as SubredditAnalysis;

    // Validate required fields
    if (!parsed.verdict || !parsed.verdictLabel || !parsed.rules) return null;

    // Clamp arrays
    parsed.rules = parsed.rules.slice(0, 10);
    parsed.dealBreakers = (parsed.dealBreakers ?? []).slice(0, 8);
    parsed.relatedSubreddits = (parsed.relatedSubreddits ?? []).slice(0, 5);
    parsed.postingStrategy = parsed.postingStrategy ?? {
      approach: "Follow subreddit rules and lead with value.",
      tips: [],
      bestContentType: "Discussion posts",
    };
    parsed.postingStrategy.tips = (parsed.postingStrategy.tips ?? []).slice(
      0,
      5,
    );

    return parsed;
  } catch {
    return null;
  }
}
