/**
 * Post structure validator for Reddit conversion (RED-63).
 * Winning structure: Headline (no product) → Value (case study, insight, tips) → Product link natural.
 * Based on Diego (17K MRR, 1M Reddit reach): product too early = ignored or downvoted.
 */

export type StructureGrade = "A" | "B" | "C" | "D" | "F";

export type StructureWarning = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type RewriteSuggestion = {
  issue: string;
  suggestion: string;
};

export type AbTestSuggestion = {
  angle: string;
  exampleHeadline: string;
};

export type ComplementaryProductSuggestion = {
  reason: string;
  tool: string;
  note: string;
};

export type PostStructureResult = {
  grade: StructureGrade;
  score: number; // 0-100
  headlineAnalysis: {
    isCatchy: boolean;
    productInHeadline: boolean;
    headlineWordCount: number;
    feedback: string;
  };
  valueSection: {
    wordsBeforeProduct: number;
    totalWords: number;
    percentValueBeforeProduct: number;
    hasSubstantiveValue: boolean;
    feedback: string;
  };
  productMention: {
    firstMentionWordIndex: number | null;
    percentThroughPost: number | null;
    tooEarly: boolean;
    feedback: string;
  };
  linkPlacement: {
    firstLinkWordIndex: number | null;
    percentThroughPost: number | null;
    isNatural: boolean;
    feedback: string;
  };
  warnings: StructureWarning[];
  rewriteSuggestions: RewriteSuggestion[];
  abTestSuggestions: AbTestSuggestion[];
  complementaryProductSuggestions: ComplementaryProductSuggestion[];
  goodBadExamples?: { good: string; bad: string };
};

const PRODUCT_PATTERNS = [
  /\b(our|my)\s+(app|product|tool|saas|platform|service|website)\b/i,
  /\bwe\s+built\b/i,
  /\bcheck\s+out\b/i,
  /\btry\s+(our|it|this)\b/i,
  /\b(use|using)\s+(our|this)\s+/i,
  /\bsign\s+up\s+(for|to)\b/i,
  /\b(get|grab)\s+(it|access)\s+(here|below)\b/i,
  /\b(link|url)\s*:\s*https?/i,
  /\bhttps?:\/\/[^\s]+/i,
  /\b(dm|pm)\s+me\b/i,
  /\bfree\s+(trial|demo)\b/i,
];

const CATCHY_HEADLINE_MIN_WORDS = 4;
const CATCHY_HEADLINE_MAX_WORDS = 15;
const VALUE_MIN_PERCENT_BEFORE_PRODUCT = 40;
const PRODUCT_SHOULD_BE_AFTER_PERCENT = 50;
const PRODUCT_TOO_EARLY_THRESHOLD_PERCENT = 30;
const LINK_NATURAL_IF_AFTER_PERCENT = 70;
const MIN_WORDS_FOR_VALUE = 30;

/** Shared good/bad example payloads for docs, tests, and UI. RED-63. */
export const GOOD_BAD_STRUCTURE_EXAMPLES = {
  good: {
    title: "3 things that 10x'd our conversion rate",
    body: "We tried ten different approaches. Here is what actually moved the needle. First we fixed the funnel. Then we ran experiments. Then we saw a 2x lift. We use ToolName for this now—link below if you want to try it. https://example.com",
    description:
      "Value-first body, product/link after 50%, no product in headline.",
  },
  bad: {
    title: "Check out our new app!",
    body: "We built this for you. Try it here: https://example.com",
    description: "Product in headline, link in first line, little value.",
  },
} as const;

function getWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function findFirstProductMatchIndex(words: string[]): number | null {
  let accumulated = "";
  for (let i = 0; i < words.length; i++) {
    accumulated = (accumulated + " " + words[i]).trim();
    const hasMatch = PRODUCT_PATTERNS.some((re) => re.test(accumulated));
    if (hasMatch) return i;
    if (accumulated.length > 120) {
      accumulated = words.slice(Math.max(0, i - 3), i + 1).join(" ");
    }
  }
  return null;
}

function findFirstLinkWordIndex(words: string[]): number | null {
  const linkRe = /https?:\/\/[^\s]+/i;
  for (let i = 0; i < words.length; i++) {
    if (linkRe.test(words[i])) return i;
  }
  return null;
}

function isHeadlineCatchy(title: string | null): boolean {
  if (!title || !title.trim()) return false;
  const words = getWords(title);
  return (
    words.length >= CATCHY_HEADLINE_MIN_WORDS &&
    words.length <= CATCHY_HEADLINE_MAX_WORDS
  );
}

function headlineHasProduct(title: string | null): boolean {
  if (!title || !title.trim()) return false;
  return PRODUCT_PATTERNS.some((re) => re.test(title));
}

/**
 * Validates draft post structure for Reddit conversion.
 * Use after draft generation (RED-40) and before scheduling.
 */
export function validatePostStructure(
  title: string | null,
  body: string,
  options?: {
    subredditStrict?: boolean;
    productCategory?: string; // e.g. "design", "dev", "marketing"
  },
): PostStructureResult {
  const warnings: StructureWarning[] = [];
  const rewriteSuggestions: RewriteSuggestion[] = [];
  const bodyWords = getWords(body);
  const titleWords = title ? getWords(title) : [];
  const totalWords = titleWords.length + bodyWords.length;

  const firstProductInBody = findFirstProductMatchIndex(bodyWords);
  const firstProductInTitle = title
    ? findFirstProductMatchIndex(titleWords)
    : null;
  const productInHeadline = headlineHasProduct(title);
  const headlineCatchy = isHeadlineCatchy(title);

  const firstProductWordIndex =
    productInHeadline && titleWords.length
      ? 0
      : firstProductInBody !== null
        ? titleWords.length + firstProductInBody
        : null;

  const percentThroughPost =
    totalWords > 0 && firstProductWordIndex !== null
      ? Math.round((100 * firstProductWordIndex) / totalWords)
      : null;

  const productTooEarly =
    percentThroughPost !== null &&
    percentThroughPost < PRODUCT_TOO_EARLY_THRESHOLD_PERCENT;

  const wordsBeforeProduct =
    firstProductInBody !== null ? firstProductInBody : bodyWords.length;
  const percentValueBeforeProduct =
    bodyWords.length > 0
      ? Math.round((100 * wordsBeforeProduct) / bodyWords.length)
      : 100;
  const hasSubstantiveValue =
    wordsBeforeProduct >= MIN_WORDS_FOR_VALUE ||
    (firstProductInBody === null && bodyWords.length >= MIN_WORDS_FOR_VALUE);

  const firstLinkIndex = findFirstLinkWordIndex(bodyWords);
  const firstLinkWordIndex =
    firstLinkIndex !== null ? titleWords.length + firstLinkIndex : null;
  const linkPercentThrough =
    totalWords > 0 && firstLinkWordIndex !== null
      ? Math.round((100 * firstLinkWordIndex) / totalWords)
      : null;
  const linkIsNatural =
    linkPercentThrough === null ||
    linkPercentThrough >= LINK_NATURAL_IF_AFTER_PERCENT;

  if (productInHeadline) {
    warnings.push({
      code: "PRODUCT_IN_HEADLINE",
      message:
        "Product or link mentioned in headline. Reddit often downvotes this.",
      severity: "error",
    });
    rewriteSuggestions.push({
      issue: "Product in headline",
      suggestion:
        "Move the product/link to the body. Use a value-focused headline (e.g. outcome, tip, or story).",
    });
  }

  if (productTooEarly && !productInHeadline) {
    warnings.push({
      code: "PRODUCT_TOO_EARLY",
      message: `Product mentioned in first ${percentThroughPost}% of post. Aim for after 50%.`,
      severity: "error",
    });
    rewriteSuggestions.push({
      issue: "Product too early",
      suggestion:
        "Lead with value: case study, tip, or insight. Mention your product or link only after the reader has gotten value.",
    });
  }

  if (!headlineCatchy && !productInHeadline) {
    warnings.push({
      code: "HEADLINE_WEAK",
      message:
        titleWords.length < CATCHY_HEADLINE_MIN_WORDS
          ? "Headline is very short; consider a clearer hook."
          : "Headline may be too long for a strong hook.",
      severity: "warning",
    });
  }

  if (!hasSubstantiveValue && firstProductInBody !== null) {
    warnings.push({
      code: "LOW_VALUE_BEFORE_PRODUCT",
      message:
        "Little value provided before product mention. Add tips, context, or story first.",
      severity: "warning",
    });
    rewriteSuggestions.push({
      issue: "Not enough value first",
      suggestion:
        "Add 2–3 sentences of genuine value (what you learned, what worked, specific tip) before any product or link.",
    });
  }

  if (!linkIsNatural && firstLinkWordIndex !== null) {
    warnings.push({
      code: "LINK_EARLY",
      message:
        "Link appears early. Consider placing it after the value section.",
      severity: "warning",
    });
    rewriteSuggestions.push({
      issue: "Link placement",
      suggestion:
        "Move the link to the end or after you've provided clear value.",
    });
  }

  const abTestSuggestions: AbTestSuggestion[] = [
    {
      angle: "Question hook",
      exampleHeadline:
        "What’s the one change that improved your [outcome] the most?",
    },
    {
      angle: "Number / list",
      exampleHeadline: "3 [tips/things] that actually worked for [audience]",
    },
    {
      angle: "How I / story",
      exampleHeadline: "How I [achieved X] without [common pain]",
    },
  ];

  let complementaryProductSuggestions: ComplementaryProductSuggestion[] = [];
  if (options?.subredditStrict) {
    complementaryProductSuggestions = [
      {
        reason:
          "Strict subreddits often allow complementary tools better than direct promo.",
        tool: "Consider linking a complementary tool first (e.g. dev tool if posting design, or vice versa).",
        note: "Example: design tool post → link Cursor (dev) as complementary, then your product.",
      },
    ];
  }
  if (options?.productCategory) {
    const cat = options.productCategory.toLowerCase();
    if (cat.includes("design") || cat.includes("figma")) {
      complementaryProductSuggestions.push({
        reason: "Design-focused post",
        tool: "Cursor (dev tool)",
        note: "Linking a complementary dev tool first can feel less salesy in mixed subs.",
      });
    }
    if (cat.includes("dev") || cat.includes("code")) {
      complementaryProductSuggestions.push({
        reason: "Dev-focused post",
        tool: "Figma or design tool",
        note: "Linking a design tool as complement can build trust before your link.",
      });
    }
  }

  const headlineFeedback = productInHeadline
    ? "Headline mentions product or link—move to body for better reception."
    : headlineCatchy
      ? "Headline length looks good and avoids product."
      : "Headline could be punchier; keep it product-free.";

  const valueFeedback =
    percentValueBeforeProduct >= VALUE_MIN_PERCENT_BEFORE_PRODUCT
      ? `About ${percentValueBeforeProduct}% of the post is value before product—good.`
      : firstProductInBody === null
        ? "No obvious product mention in body—structure is value-first."
        : `Only ~${percentValueBeforeProduct}% value before product—add more value first.`;

  const productFeedback =
    percentThroughPost === null
      ? "No clear product mention detected—ensure value is clear."
      : productTooEarly
        ? `Product appears at ~${percentThroughPost}%—too early. Aim for after 50%.`
        : percentThroughPost >= PRODUCT_SHOULD_BE_AFTER_PERCENT
          ? `Product at ~${percentThroughPost}%—good placement.`
          : `Product at ~${percentThroughPost}%—consider moving slightly later.`;

  const linkFeedback =
    firstLinkWordIndex === null
      ? "No link in body—fine if you’re linking in comments or later."
      : linkIsNatural
        ? `Link at ~${linkPercentThrough}%—natural placement.`
        : `Link at ~${linkPercentThrough}%—moving it later may feel less salesy.`;

  const score = computeScore({
    productInHeadline,
    productTooEarly,
    percentThroughPost,
    percentValueBeforeProduct,
    hasSubstantiveValue,
    headlineCatchy,
    linkIsNatural,
  });

  const grade = scoreToGrade(score);

  return {
    grade,
    score,
    headlineAnalysis: {
      isCatchy: headlineCatchy,
      productInHeadline,
      headlineWordCount: titleWords.length,
      feedback: headlineFeedback,
    },
    valueSection: {
      wordsBeforeProduct,
      totalWords: bodyWords.length,
      percentValueBeforeProduct,
      hasSubstantiveValue,
      feedback: valueFeedback,
    },
    productMention: {
      firstMentionWordIndex: firstProductWordIndex,
      percentThroughPost,
      tooEarly: productTooEarly,
      feedback: productFeedback,
    },
    linkPlacement: {
      firstLinkWordIndex,
      percentThroughPost: linkPercentThrough,
      isNatural: linkIsNatural,
      feedback: linkFeedback,
    },
    warnings,
    rewriteSuggestions,
    abTestSuggestions,
    complementaryProductSuggestions,
    goodBadExamples: {
      good: '**Good:** "3 things that 10x’d our conversion" → value in body → "We use [tool] for this, link below."',
      bad: `Bad: "${GOOD_BAD_STRUCTURE_EXAMPLES.bad.title}" → link in first line.`,
    },
  };
}

function computeScore(params: {
  productInHeadline: boolean;
  productTooEarly: boolean;
  percentThroughPost: number | null;
  percentValueBeforeProduct: number;
  hasSubstantiveValue: boolean;
  headlineCatchy: boolean;
  linkIsNatural: boolean;
}): number {
  let s = 100;
  if (params.productInHeadline) s -= 40;
  else if (params.productTooEarly) s -= 35;
  else if (
    params.percentThroughPost !== null &&
    params.percentThroughPost < 50
  ) {
    s -= 20;
  }

  if (params.percentValueBeforeProduct < VALUE_MIN_PERCENT_BEFORE_PRODUCT) {
    s -= 15;
  }
  if (!params.hasSubstantiveValue) s -= 10;
  if (!params.headlineCatchy && !params.productInHeadline) s -= 5;
  if (!params.linkIsNatural) s -= 10;
  return Math.max(0, Math.min(100, s));
}

function scoreToGrade(score: number): StructureGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
