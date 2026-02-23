import type { DraftVariant } from "@/lib/content/generator";

export type PostGeneratorGoal =
  | "awareness"
  | "feedback"
  | "launch"
  | "case-study";

type BuildPostGeneratorFallbackInput = {
  topic: string;
  product: string;
  audience: string;
  tone: string;
  goal: PostGeneratorGoal;
  subredditName: string | null;
  subredditRulesText: string | null;
};

type PostAngle = {
  heading: string;
  insightPrompt: string;
  questionPrompt: string;
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[.,;:!?]+$/g, "").trim();
}

function lowercaseFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function uppercaseFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function normalizePostGeneratorText(value: string) {
  return stripTrailingPunctuation(collapseWhitespace(value));
}

export function normalizePostGeneratorTopic(topic: string) {
  const original = collapseWhitespace(topic);
  const strippedPrefix = original.replace(
    /^(discuss|talk|write|post)\s+(about|on)\s+/i,
    "",
  );
  const strippedAbout = strippedPrefix.replace(/^about\s+/i, "");
  const cleaned = stripTrailingPunctuation(strippedAbout);
  if (cleaned.length >= 3) return cleaned;
  return stripTrailingPunctuation(original);
}

const ANGLES_BY_GOAL: Record<PostGeneratorGoal, PostAngle[]> = {
  awareness: [
    {
      heading: "practical lesson",
      insightPrompt: "Share one concrete lesson that changed your approach.",
      questionPrompt:
        "What is one tactic you wish you learned earlier in this niche?",
    },
    {
      heading: "myth vs reality",
      insightPrompt: "Contrast a common belief with what actually worked.",
      questionPrompt:
        "Which assumptions in this space were wrong for you in practice?",
    },
    {
      heading: "framework",
      insightPrompt:
        "Give a compact framework others can apply immediately without tools.",
      questionPrompt:
        "What would you add or remove from this framework in your context?",
    },
  ],
  feedback: [
    {
      heading: "current plan",
      insightPrompt:
        "Share your current draft plan and your biggest uncertainty.",
      questionPrompt:
        "Which part of this plan is weakest or most likely to fail?",
    },
    {
      heading: "decision tradeoff",
      insightPrompt:
        "Explain two options you are considering and the tradeoff.",
      questionPrompt: "Which option would you choose and why?",
    },
    {
      heading: "experiment design",
      insightPrompt:
        "Outline one experiment with success criteria and constraints.",
      questionPrompt:
        "How would you tighten this experiment before running it?",
    },
  ],
  launch: [
    {
      heading: "build journey",
      insightPrompt:
        "Share what you built, who it is for, and what surprised you.",
      questionPrompt:
        "What would make this update more useful to this community?",
    },
    {
      heading: "first outcomes",
      insightPrompt:
        "Summarize early outcomes with transparent caveats and next steps.",
      questionPrompt:
        "Which metric would you prioritize improving first after launch?",
    },
    {
      heading: "post-launch learning",
      insightPrompt: "Focus on a mistake, correction, and current hypothesis.",
      questionPrompt:
        "Have you seen similar post-launch problems and how did you solve them?",
    },
  ],
  "case-study": [
    {
      heading: "before and after",
      insightPrompt:
        "Share baseline, intervention, and outcome in plain language.",
      questionPrompt:
        "What additional context would make these results more trustworthy?",
    },
    {
      heading: "playbook breakdown",
      insightPrompt:
        "Break down a repeatable playbook others can adapt with limits noted.",
      questionPrompt:
        "Which step in this playbook is most fragile in your experience?",
    },
    {
      heading: "counterintuitive finding",
      insightPrompt:
        "Highlight one result that contradicted your expectation and why.",
      questionPrompt:
        "Have you seen similar counterintuitive outcomes in this space?",
    },
  ],
};

function trimLength(input: string, length: "short" | "medium" | "long") {
  const target = length === "short" ? 280 : length === "medium" ? 700 : 1500;
  if (input.length <= target) return input;
  return `${input.slice(0, target - 3).trim()}...`;
}

function normalizeSubreddit(subredditName: string | null) {
  if (!subredditName) return null;
  return subredditName.replace(/^r\//i, "");
}

function goalLabel(goal: PostGeneratorGoal) {
  if (goal === "case-study") return "case study";
  return goal;
}

function summarizeRules(rawRules: string | null) {
  if (!rawRules) return null;
  const compact = rawRules
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
  return compact.length > 0 ? compact : null;
}

function toneStyleHint(tone: string) {
  const normalized = tone.trim().toLowerCase();
  if (normalized.includes("data")) {
    return "Keep claims specific and evidence-oriented.";
  }
  if (normalized.includes("story")) {
    return "Use first-person storytelling with concrete moments.";
  }
  if (normalized.includes("question")) {
    return "Lead with curiosity and end with one focused question.";
  }
  if (normalized.includes("friendly")) {
    return "Use warm, respectful language and avoid hype.";
  }
  return "Use clear, practical language and avoid promotional CTA.";
}

function buildVariantBody(input: {
  angle: PostAngle;
  topic: string;
  product: string;
  audience: string;
  tone: string;
  subredditName: string | null;
  goal: PostGeneratorGoal;
  rulesSummary: string | null;
  index: number;
}) {
  const topic = normalizePostGeneratorTopic(input.topic);
  const contextLine = `I'm building ${input.product} for ${input.audience}. I'm exploring ${lowercaseFirst(topic)}.`;
  const subredditContext = input.subredditName
    ? `Posting with r/${input.subredditName} norms in mind.`
    : null;
  const rulesContext = input.rulesSummary
    ? `Rules to respect: ${input.rulesSummary}`
    : null;
  const toneHint = toneStyleHint(input.tone);
  const goalLine = `Goal: ${goalLabel(input.goal)} without spammy language.`;

  return [
    contextLine,
    subredditContext,
    goalLine,
    "",
    `Angle ${input.index}: ${input.angle.heading}`,
    input.angle.insightPrompt,
    "",
    "What I can share:",
    "- Context and constraints",
    "- What I tested and what changed",
    "- One practical takeaway someone can apply quickly",
    "",
    toneHint,
    rulesContext,
    "",
    `Question: ${input.angle.questionPrompt}`,
  ]
    .filter((line) => line != null && line.length > 0)
    .join("\n");
}

export function buildPostGeneratorFallbackVariants(
  input: BuildPostGeneratorFallbackInput,
  preferredLength: "short" | "medium" | "long" = "medium",
) {
  const normalizedTopic = normalizePostGeneratorTopic(input.topic);
  const normalizedProduct =
    normalizePostGeneratorText(input.product) ||
    collapseWhitespace(input.product);
  const normalizedAudience =
    normalizePostGeneratorText(input.audience) ||
    collapseWhitespace(input.audience);
  const normalizedTone =
    normalizePostGeneratorText(input.tone) || collapseWhitespace(input.tone);
  const normalizedSubreddit = normalizeSubreddit(input.subredditName);
  const angles = ANGLES_BY_GOAL[input.goal];
  const rulesSummary = summarizeRules(input.subredditRulesText);

  const variants: DraftVariant[] = angles.map((angle, index) => {
    const variantIndex = index + 1;
    const subredditSuffix = normalizedSubreddit
      ? ` for r/${normalizedSubreddit}`
      : "";
    const title = trimLength(
      `${goalLabel(input.goal)} angle ${variantIndex}: ${uppercaseFirst(normalizedTopic)}${subredditSuffix}`,
      "short",
    );
    const body = trimLength(
      buildVariantBody({
        angle,
        topic: normalizedTopic,
        product: normalizedProduct,
        audience: normalizedAudience,
        tone: normalizedTone,
        subredditName: normalizedSubreddit,
        goal: input.goal,
        rulesSummary,
        index: variantIndex,
      }),
      preferredLength,
    );

    return {
      title,
      body,
      score: Number((0.9 - index * 0.1).toFixed(2)),
    };
  });

  return {
    variants,
    primary: variants[0],
  };
}
