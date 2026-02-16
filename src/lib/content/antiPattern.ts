export type AntiPatternResult = {
  penalty: number;
  flags: string[];
  reasons: string[];
  fixes: Array<{ issue: string; fix: string }>;
};

type AntiPatternRule = {
  flag: string;
  pattern: RegExp;
  penalty: number;
  reason: string;
  issue: string;
  fix: string;
};

const MAX_ANTI_PATTERN_PENALTY = 20;

const ANTI_PATTERN_RULES: AntiPatternRule[] = [
  {
    flag: "vote_manipulation",
    pattern:
      /\b(please\s+)?(upvote|downvote)\b|\b(upvote|downvote)\s+(this|if)\b|\bsmash\s+that\s+upvote\b/i,
    penalty: 8,
    reason: "Includes vote manipulation language",
    issue: "Vote manipulation",
    fix: "Remove vote requests and focus on authentic discussion prompts.",
  },
  {
    flag: "engagement_gating",
    pattern:
      /\b(comment|reply)\s+["'][^"']{1,40}["']\s+(and|to)\s+i(?:'|’)ll\b|\b(dm|message)\s+me\s+for\b/i,
    penalty: 7,
    reason: "Uses gated engagement patterns",
    issue: "Engagement bait",
    fix: "Ask open questions without gating access behind comments or DMs.",
  },
  {
    flag: "karma_farming",
    pattern:
      /\b(help me|get me|need)\s+(get\s+)?(karma|upvotes)\b|\bkarma\s*(farm|farming)\b/i,
    penalty: 6,
    reason: "Looks like karma farming behavior",
    issue: "Karma farming",
    fix: "Replace karma requests with context-rich content that stands on value.",
  },
  {
    flag: "award_bait_edit",
    pattern: /\bedit:\s*(thanks|wow).{0,40}\b(upvotes|gold|awards)\b/i,
    penalty: 4,
    reason: "Includes award/upvote bait edit language",
    issue: "Award bait",
    fix: "Avoid meta edits about votes/awards in the post body.",
  },
];

function detectRepeatedSentence(body: string) {
  const sentences = body
    .toLowerCase()
    .split(/[.!?]\s+/)
    .map((s) => s.trim().replace(/[.!?]+$/g, ""))
    .filter((s) => s.length >= 24);
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count > 1);
}

export function evaluateAntiPattern(input: {
  title: string | null;
  body: string;
}): AntiPatternResult {
  const combined = `${input.title ?? ""}\n${input.body}`.trim();
  const flags: string[] = [];
  const reasons: string[] = [];
  const fixes: Array<{ issue: string; fix: string }> = [];
  let penalty = 0;

  for (const rule of ANTI_PATTERN_RULES) {
    if (!rule.pattern.test(combined)) continue;
    penalty += rule.penalty;
    flags.push(rule.flag);
    reasons.push(rule.reason);
    fixes.push({ issue: rule.issue, fix: rule.fix });
  }

  if (detectRepeatedSentence(input.body)) {
    penalty += 5;
    flags.push("duplicate_sentence");
    reasons.push("Repeated sentence blocks may look templated or spammy");
    fixes.push({
      issue: "Duplicate sentence blocks",
      fix: "Remove repeated lines and keep one clear, concise version.",
    });
  }

  return {
    penalty: Math.max(0, Math.min(MAX_ANTI_PATTERN_PENALTY, penalty)),
    flags,
    reasons,
    fixes,
  };
}
