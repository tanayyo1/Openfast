type ParsedRules = {
  rulesJson: Record<string, unknown>;
  rawRules: string;
  promoAllowed: "ALLOWED" | "DISALLOWED" | "CONTEXTUAL_ONLY" | "UNKNOWN";
  linkPolicy:
    | "ALLOWED"
    | "DISALLOWED_IN_POSTS"
    | "DISALLOWED_IN_COMMENTS"
    | "DISALLOWED_EVERYWHERE"
    | "UNKNOWN";
  selfPromoAllowed: boolean;
  affiliateAllowed: boolean;
  flairRequired: boolean;
  textOnly: boolean;
  noLinksInPosts: boolean;
  noLinksInComments: boolean;
  notes: string;
};

const DISALLOW_PATTERNS = [
  /\bno self[- ]promo/i,
  /\bno promotion/i,
  /\bdo not promote/i,
  /\bpromotion is not allowed/i,
];

const CONTEXTUAL_PATTERNS = [
  /\bonly if relevant/i,
  /\bmust add value/i,
  /\bcontextual/i,
  /\blimited self[- ]promo/i,
];

const AFFILIATE_PATTERNS = [/\baffiliate\b/i, /\breferral\b/i];

const FLAIR_PATTERNS = [/\bflair required\b/i, /\brequire flair\b/i];

const TEXT_ONLY_PATTERNS = [/\btext only\b/i, /\bno image posts\b/i];

const NO_LINKS_POST_PATTERNS = [
  /\bno links in posts\b/i,
  /\blinks are not allowed in posts\b/i,
];

const NO_LINKS_COMMENT_PATTERNS = [
  /\bno links in comments\b/i,
  /\blinks are not allowed in comments\b/i,
];

function hasAnyPattern(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

export function parseSubredditRules(rawRulesInput: string[]): ParsedRules {
  const sanitized = rawRulesInput
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .slice(0, 100);

  const rawRules = sanitized.join("\n");
  const text = rawRules.toLowerCase();

  const hasDisallowPromo = hasAnyPattern(text, DISALLOW_PATTERNS);
  const hasContextualPromo = hasAnyPattern(text, CONTEXTUAL_PATTERNS);
  const hasAffiliate = hasAnyPattern(text, AFFILIATE_PATTERNS);
  const flairRequired = hasAnyPattern(text, FLAIR_PATTERNS);
  const textOnly = hasAnyPattern(text, TEXT_ONLY_PATTERNS);
  const noLinksInPosts = hasAnyPattern(text, NO_LINKS_POST_PATTERNS);
  const noLinksInComments = hasAnyPattern(text, NO_LINKS_COMMENT_PATTERNS);

  let promoAllowed: ParsedRules["promoAllowed"] = "UNKNOWN";
  if (hasDisallowPromo) promoAllowed = "DISALLOWED";
  else if (hasContextualPromo) promoAllowed = "CONTEXTUAL_ONLY";
  else if (sanitized.length > 0) promoAllowed = "ALLOWED";

  const linkPolicy: ParsedRules["linkPolicy"] =
    noLinksInPosts && noLinksInComments
      ? "DISALLOWED_EVERYWHERE"
      : noLinksInPosts
        ? "DISALLOWED_IN_POSTS"
        : noLinksInComments
          ? "DISALLOWED_IN_COMMENTS"
          : sanitized.length > 0
            ? "ALLOWED"
            : "UNKNOWN";

  return {
    rulesJson: {
      parsedFrom: "rules_text_v1",
      rules: sanitized,
    },
    rawRules,
    promoAllowed,
    linkPolicy,
    selfPromoAllowed: promoAllowed === "ALLOWED",
    affiliateAllowed: !hasAffiliate,
    flairRequired,
    textOnly,
    noLinksInPosts,
    noLinksInComments,
    notes: `Parsed ${sanitized.length} rule lines`,
  };
}
