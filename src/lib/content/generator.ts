export type DraftVariant = {
  title: string | null;
  body: string;
  score: number;
};

export type RiskAssessment = {
  riskScore: number;
  riskReasons: string[];
  suggestedFixes: Array<{ issue: string; fix: string }>;
};

type BuildVariantInput = {
  mode: "GENERATE" | "REWRITE" | "COMPLIANCE";
  baseTitle: string | null;
  baseBody: string;
  taskTitle: string | null;
  taskInstructions: string;
  projectName: string;
  brandVoice: unknown;
  subredditName: string | null;
  subredditRulesText: string | null;
  variantCount: number;
};

function normalizeTone(brandVoice: unknown, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim().toLowerCase();

  if (brandVoice && typeof brandVoice === "object") {
    const tone = (brandVoice as Record<string, unknown>).tone;
    if (typeof tone === "string" && tone.trim()) {
      return tone.trim().toLowerCase();
    }
  }

  return "neutral";
}

function tonePrefix(tone: string) {
  if (tone.includes("casual")) return "Conversational";
  if (tone.includes("professional")) return "Professional";
  if (tone.includes("friendly")) return "Friendly";
  if (tone.includes("direct")) return "Direct";
  return "Balanced";
}

function trimLength(input: string, length: "short" | "medium" | "long") {
  const target = length === "short" ? 280 : length === "medium" ? 700 : 1_500;
  if (input.length <= target) return input;
  return `${input.slice(0, target - 3).trim()}...`;
}

function normalizeRuleSummary(rawRules: string | null) {
  if (!rawRules) return "";
  const compact = rawRules
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("; ");
  return compact;
}

export function assessRisk(
  title: string | null,
  body: string,
  rulesText: string | null,
): RiskAssessment {
  const riskReasons: string[] = [];
  const suggestedFixes: Array<{ issue: string; fix: string }> = [];
  let riskScore = 12;

  const combined = `${title ?? ""}\n${body}`.toLowerCase();
  const rules = (rulesText ?? "").toLowerCase();

  const promoPhrases = [
    "buy now",
    "limited time",
    "guaranteed",
    "dm me",
    "sign up",
    "act now",
    "my product",
  ];
  if (promoPhrases.some((phrase) => combined.includes(phrase))) {
    riskScore += 28;
    riskReasons.push("Contains promotional or hard-CTA language");
    suggestedFixes.push({
      issue: "Promotional phrasing",
      fix: "Switch to educational framing and remove direct calls to action",
    });
  }

  const hasLink = /https?:\/\//i.test(combined);
  if (hasLink) {
    riskScore += 18;
    riskReasons.push("Contains external links");
    suggestedFixes.push({
      issue: "External links",
      fix: "Remove direct links and mention resources without URL spam",
    });
  }

  if (
    hasLink &&
    (rules.includes("no links") ||
      rules.includes("links are not allowed") ||
      rules.includes("no self-promo"))
  ) {
    riskScore += 26;
    riskReasons.push("May violate subreddit link/self-promo rules");
    suggestedFixes.push({
      issue: "Potential subreddit-rule conflict",
      fix: "Adapt content to text-only value and remove promotional mentions",
    });
  }

  if (body.length < 80) {
    riskScore += 8;
    riskReasons.push("Low-context content may look spammy");
    suggestedFixes.push({
      issue: "Too short",
      fix: "Add concrete context, outcomes, and an explicit ask for discussion",
    });
  }

  if (body.length > 2_500) {
    riskScore += 10;
    riskReasons.push("Long-form body may reduce readability");
    suggestedFixes.push({
      issue: "Too long",
      fix: "Tighten the post and keep only key points relevant to subreddit",
    });
  }

  riskScore = Math.min(100, riskScore);
  return { riskScore, riskReasons, suggestedFixes };
}

export function buildDraftVariants(
  input: BuildVariantInput,
  preferredLength: "short" | "medium" | "long" = "medium",
): { variants: DraftVariant[]; primary: DraftVariant } {
  const tone = normalizeTone(input.brandVoice);
  const prefix = tonePrefix(tone);
  const rulesSummary = normalizeRuleSummary(input.subredditRulesText);
  const taskTitle = input.taskTitle ?? "Task";
  const baseBody =
    input.mode === "GENERATE"
      ? `${input.taskInstructions}\n\nShare a real example and ask for feedback.`
      : input.baseBody;
  const baseTitle =
    input.baseTitle ??
    `${taskTitle} for ${input.subredditName ? `r/${input.subredditName}` : "Reddit"}`;

  const variants: DraftVariant[] = [];
  const count = Math.max(3, Math.min(5, input.variantCount));

  for (let i = 0; i < count; i += 1) {
    const variantLabel = i + 1;
    let title = `${prefix} angle ${variantLabel}: ${baseTitle}`;
    let body = `${baseBody}\n\n`;

    if (input.mode === "REWRITE") {
      body += `Rewritten with a ${tone} tone for ${input.projectName}.`;
    } else if (input.mode === "COMPLIANCE") {
      body +=
        "Compliance-focused rewrite with reduced promotion and safer language.";
    } else {
      body += `Generated for ${input.projectName} with ${tone} tone.`;
    }

    if (rulesSummary) {
      body += `\n\nRule context considered: ${rulesSummary}`;
    }

    body += `\n\nVariant ${variantLabel}: focus on actionable insight, avoid hype, and invite discussion.`;

    title = trimLength(title, "short");
    body = trimLength(body, preferredLength);

    variants.push({
      title,
      body,
      score: Number((0.9 - i * 0.1).toFixed(2)),
    });
  }

  return { variants, primary: variants[0] };
}
