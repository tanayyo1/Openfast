type ProjectInput = {
  niche: string;
  goals: unknown;
  constraints: unknown;
};

type SubredditInput = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  subscribers: number;
  activeUsers: number;
  avgPostsPerDay: number | null;
  avgCommentsPerPost: number | null;
  policy: {
    promoAllowed: "ALLOWED" | "DISALLOWED" | "CONTEXTUAL_ONLY" | "UNKNOWN";
    linkPolicy:
      | "ALLOWED"
      | "DISALLOWED_IN_POSTS"
      | "DISALLOWED_IN_COMMENTS"
      | "DISALLOWED_EVERYWHERE"
      | "UNKNOWN";
    selfPromoAllowed: boolean;
    affiliateAllowed: boolean;
  } | null;
  bestTimeScore: number;
};

export type RankedRecommendation = {
  subredditId: string;
  fitScore: number;
  riskScore: number;
  timeScore: number;
  totalScore: number;
  reasons: string[];
};

export type RankedSubredditScore = {
  subredditId: string;
  fitScore: number;
  riskScore: number;
  timeWindowScore: number;
  compositeScore: number;
};

type GoalIntent = {
  reach: boolean;
  engagement: boolean;
  conversion: boolean;
};

const TOKEN_STOPWORDS = new Set([
  "a",
  "about",
  "an",
  "after",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "do",
  "for",
  "from",
  "have",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "those",
  "to",
  "up",
  "via",
  "was",
  "we",
  "with",
  "without",
  "you",
  "your",
]);

const BROAD_SUBREDDIT_NAMES = new Set([
  "askreddit",
  "funny",
  "gaming",
  "memes",
  "movies",
  "news",
  "pics",
  "todayilearned",
  "videos",
  "worldnews",
]);

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function normalize(value: number, max: number) {
  if (max <= 0) return 0;
  return clamp(value / max);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !TOKEN_STOPWORDS.has(token));
}

function collectStringValues(input: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof input === "string") return [input];
  if (Array.isArray(input)) {
    return input.slice(0, 25).flatMap((item) => collectStringValues(item, depth + 1));
  }
  if (input && typeof input === "object") {
    return Object.values(input as Record<string, unknown>)
      .slice(0, 25)
      .flatMap((value) => collectStringValues(value, depth + 1));
  }
  return [];
}

function extractConstraintSignals(constraints: unknown) {
  const requiredTokens = new Set<string>();
  const avoidedTokens = new Set<string>();
  const hasNegation = (text: string) =>
    /\b(?:no|not|never|avoid|avoiding|without|exclude|excluding|ban|banned|do\s+not|don't|dont)\b/.test(
      text,
    );
  const clauses = collectStringValues(constraints)
    .slice(0, 80)
    .flatMap((text) => text.split(/[.;,\n]+/))
    .map((text) => text.trim().toLowerCase())
    .filter((text) => text.length > 0);
  for (const clause of clauses) {
    const tokens = tokenize(clause);
    if (tokens.length === 0) continue;
    if (hasNegation(clause)) {
      for (const token of tokens) avoidedTokens.add(token);
      continue;
    }
    for (const token of tokens) requiredTokens.add(token);
  }
  return { requiredTokens, avoidedTokens };
}

function buildProjectTokenWeights(project: ProjectInput) {
  const weights = new Map<string, number>();
  const apply = (tokens: string[], weight: number) => {
    for (const token of tokens) {
      const current = weights.get(token) ?? 0;
      if (weight > current) weights.set(token, weight);
    }
  };

  apply(tokenize(project.niche ?? ""), 1.4);
  apply(
    collectStringValues(project.goals)
      .flatMap((text) => tokenize(text))
      .slice(0, 80),
    1.15,
  );
  const { requiredTokens, avoidedTokens } = extractConstraintSignals(
    project.constraints,
  );
  apply(Array.from(requiredTokens), 0.8);
  for (const token of avoidedTokens) {
    weights.delete(token);
  }
  return { weights, avoidedTokens };
}

function overlapScore(input: {
  projectTokenWeights: Map<string, number>;
  avoidedTokens: Set<string>;
  subText: string;
}) {
  const { projectTokenWeights, avoidedTokens, subText } = input;
  if (projectTokenWeights.size === 0) {
    const subTokens = new Set(tokenize(subText));
    let matchedAvoidedCount = 0;
    for (const token of avoidedTokens) {
      if (subTokens.has(token)) matchedAvoidedCount += 1;
    }
    return {
      score: 0,
      matchedWeight: 0,
      totalWeight: 0,
      matchedKeywordCount: 0,
      matchedAvoidedCount,
    };
  }

  const subTokens = new Set(tokenize(subText));
  let matchedWeight = 0;
  let totalWeight = 0;
  let matchedKeywordCount = 0;
  let matchedAvoidedCount = 0;
  for (const [token, weight] of projectTokenWeights) {
    totalWeight += weight;
    if (subTokens.has(token)) {
      matchedWeight += weight;
      matchedKeywordCount += 1;
    }
  }
  for (const token of avoidedTokens) {
    if (subTokens.has(token)) matchedAvoidedCount += 1;
  }
  return {
    score: clamp(matchedWeight / Math.max(totalWeight, 0.0001)),
    matchedWeight,
    totalWeight,
    matchedKeywordCount,
    matchedAvoidedCount,
  };
}

function detectGoalIntent(goals: unknown): GoalIntent {
  const tokens = collectStringValues(goals).flatMap((text) => tokenize(text));
  if (tokens.length === 0) {
    return { reach: false, engagement: false, conversion: false };
  }
  const has = (...needles: string[]) => needles.some((needle) => tokens.includes(needle));
  return {
    reach: has("traffic", "growth", "awareness", "reach", "distribution"),
    engagement: has("community", "engagement", "discussion", "comments", "conversation"),
    conversion: has("conversion", "conversions", "leads", "sales", "signup", "signups"),
  };
}

function computeGoalFit(input: {
  goalIntent: GoalIntent;
  audienceFit: number;
  cadenceFit: number;
  conversationFit: number;
  riskProxy: number;
}) {
  const tracks: number[] = [];
  if (input.goalIntent.reach) {
    tracks.push(input.audienceFit * 0.7 + input.cadenceFit * 0.3);
  }
  if (input.goalIntent.engagement) {
    tracks.push(input.conversationFit * 0.6 + input.audienceFit * 0.4);
  }
  if (input.goalIntent.conversion) {
    tracks.push(
      (1 - input.riskProxy) * 0.45 +
        input.conversationFit * 0.3 +
        input.audienceFit * 0.25,
    );
  }
  if (tracks.length === 0) {
    tracks.push(input.audienceFit * 0.6 + input.cadenceFit * 0.4);
  }
  return tracks.reduce((sum, score) => sum + score, 0) / tracks.length;
}

function computeRiskProxy(sub: SubredditInput) {
  if (!sub.policy) return 0.6;
  if (sub.policy.promoAllowed === "DISALLOWED") return 0.9;
  if (sub.policy.promoAllowed === "CONTEXTUAL_ONLY") return 0.55;
  if (sub.policy.promoAllowed === "UNKNOWN") return 0.65;
  if (sub.policy.linkPolicy === "UNKNOWN") return 0.45;
  return 0.2;
}

function computeFitBreakdown(project: ProjectInput, sub: SubredditInput) {
  const projectTokens = buildProjectTokenWeights(project);
  const text = `${sub.name} ${sub.title} ${sub.description ?? ""}`;
  const overlap = overlapScore({
    projectTokenWeights: projectTokens.weights,
    avoidedTokens: projectTokens.avoidedTokens,
    subText: text,
  });
  const semanticFit = overlap.score;
  const audienceFit = normalize(sub.activeUsers, 40_000);
  const cadenceFit = normalize(sub.avgPostsPerDay ?? 0, 120);
  const conversationFit = normalize(sub.avgCommentsPerPost ?? 0, 20);
  const riskProxy = computeRiskProxy(sub);
  const goalIntent = detectGoalIntent(project.goals);
  const goalFit = computeGoalFit({
    goalIntent,
    audienceFit,
    cadenceFit,
    conversationFit,
    riskProxy,
  });
  const goalFitCapped = semanticFit < 0.2 ? Math.min(goalFit, 0.45) : goalFit;
  const constraintMismatchPenalty = clamp(overlap.matchedAvoidedCount * 0.08, 0, 0.24);
  const fitScore = clamp(
    semanticFit * 0.58 + goalFitCapped * 0.3 + cadenceFit * 0.12 - constraintMismatchPenalty,
  );
  return {
    fitScore,
    semanticFit,
    goalFit: goalFitCapped,
    audienceFit,
    cadenceFit,
    conversationFit,
    matchedKeywordCount: overlap.matchedKeywordCount,
    keywordCount: projectTokens.weights.size,
    matchedAvoidedCount: overlap.matchedAvoidedCount,
    constraintMismatchPenalty,
    goalIntent,
  };
}

function computeBaseRiskScore(sub: SubredditInput) {
  let risk = 0.15;
  if (!sub.policy) {
    risk += 0.2;
  } else if (sub.policy.promoAllowed === "DISALLOWED") {
    risk += 0.45;
  } else if (sub.policy.promoAllowed === "CONTEXTUAL_ONLY") {
    risk += 0.2;
  } else if (sub.policy.promoAllowed === "UNKNOWN") {
    risk += 0.14;
  }

  if (
    sub.policy?.linkPolicy === "DISALLOWED_EVERYWHERE" ||
    sub.policy?.linkPolicy === "DISALLOWED_IN_POSTS"
  ) {
    risk += 0.2;
  } else if (sub.policy?.linkPolicy === "UNKNOWN") {
    risk += 0.08;
  }
  if (sub.policy?.selfPromoAllowed === false) risk += 0.1;
  if (sub.policy?.affiliateAllowed === false) risk += 0.05;

  // Small/low-activity subs can be noisy for predictable growth.
  if (sub.activeUsers < 50) risk += 0.1;
  return clamp(risk);
}

function computeBroadAudiencePenalty(input: {
  sub: SubredditInput;
  semanticFit: number;
}) {
  const { sub, semanticFit } = input;
  let penalty = 0;
  if (
    semanticFit < 0.2 &&
    BROAD_SUBREDDIT_NAMES.has(sub.name.toLowerCase())
  ) {
    penalty += 0.08;
  }
  if (semanticFit < 0.18 && sub.activeUsers > 4_000) {
    penalty += normalize(sub.activeUsers, 80_000) * 0.16;
  }
  if (semanticFit < 0.1 && sub.activeUsers > 50_000) {
    penalty += 0.12;
  }
  if (semanticFit < 0.12 && sub.subscribers > 500_000) {
    penalty += 0.12;
  }
  return clamp(penalty, 0, 0.45);
}

function buildReasons(input: {
  fitScore: number;
  riskScore: number;
  timeScore: number;
  broadAudiencePenalty: number;
  fit: ReturnType<typeof computeFitBreakdown>;
  sub: SubredditInput;
}) {
  const reasons = [
    `Niche match ${Math.round(input.fit.semanticFit * 100)}% (${input.fit.matchedKeywordCount}/${Math.max(input.fit.keywordCount, 1)} keywords).`,
    `Goal alignment ${Math.round(input.fit.goalFit * 100)}% based on audience and engagement signals.`,
    `Best-time signal ${Math.round(input.timeScore * 100)}%.`,
    `fit=${input.fitScore.toFixed(2)} risk=${input.riskScore.toFixed(2)} time=${input.timeScore.toFixed(2)}`,
  ];
  if (input.fit.goalIntent.reach) {
    reasons.push("Supports reach-focused goals via active audience/cadence.");
  }
  if (input.fit.goalIntent.engagement) {
    reasons.push("Supports engagement-focused goals via comment activity.");
  }
  if (input.fit.goalIntent.conversion) {
    reasons.push("Conversion goal considered with moderation-risk sensitivity.");
  }
  if (input.broadAudiencePenalty > 0) {
    reasons.push("Applied broad-audience penalty due to weak niche specificity.");
  }
  if (input.fit.matchedAvoidedCount > 0) {
    reasons.push(
      `Constraint conflict detected (${input.fit.matchedAvoidedCount} avoided keyword matches).`,
    );
  }
  if (input.sub.policy?.promoAllowed === "DISALLOWED") {
    reasons.push("Strict promo policy increases execution risk.");
  } else if (!input.sub.policy || input.sub.policy.promoAllowed === "UNKNOWN") {
    reasons.push("Moderation policy data is incomplete; risk adjusted conservatively.");
  }
  if (input.sub.avgCommentsPerPost && input.sub.avgCommentsPerPost > 10) {
    reasons.push("Strong comment activity.");
  }
  if (input.sub.activeUsers > 5000) {
    reasons.push("Healthy active audience.");
  }
  return reasons;
}

export function rankSubreddits(
  project: ProjectInput,
  subreddits: SubredditInput[],
  limit = 5,
): RankedRecommendation[] {
  return subreddits
    .map((sub) => {
      const fit = computeFitBreakdown(project, sub);
      const broadAudiencePenalty = computeBroadAudiencePenalty({
        sub,
        semanticFit: fit.semanticFit,
      });
      const fitScore = fit.fitScore;
      const riskScore = clamp(
        computeBaseRiskScore(sub) + broadAudiencePenalty,
      );
      const timeScore = clamp(sub.bestTimeScore);
      const totalScore = clamp(
        fitScore * 0.55 + timeScore * 0.25 - riskScore * 0.2,
      );

      const reasons = buildReasons({
        fitScore,
        riskScore,
        timeScore,
        broadAudiencePenalty,
        fit,
        sub,
      });

      return {
        subredditId: sub.id,
        fitScore,
        riskScore,
        timeScore,
        totalScore,
        reasons,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);
}

export function rankTopSubreddits(
  scores: Array<{
    subredditId: string;
    fitScore: number;
    riskScore: number;
    timeWindowScore: number;
  }>,
  opts?: { limit?: number },
): RankedSubredditScore[] {
  const limit = opts?.limit ?? 5;
  return scores
    .map((item) => ({
      ...item,
      compositeScore: clamp(
        item.fitScore * 0.55 +
          item.timeWindowScore * 0.25 -
          item.riskScore * 0.2,
      ),
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, limit);
}
