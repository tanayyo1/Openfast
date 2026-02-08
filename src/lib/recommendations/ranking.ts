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

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function normalize(value: number, max: number) {
  if (max <= 0) return 0;
  return clamp(value / max);
}

function getProjectKeywords(project: ProjectInput): string[] {
  const base = [project.niche ?? ""];
  if (typeof project.goals === "object" && project.goals !== null) {
    base.push(JSON.stringify(project.goals));
  }
  if (typeof project.constraints === "object" && project.constraints !== null) {
    base.push(JSON.stringify(project.constraints));
  }
  return base
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function overlapScore(projectTokens: string[], subText: string) {
  if (projectTokens.length === 0) return 0;
  const unique = new Set(projectTokens);
  const text = subText.toLowerCase();
  let hits = 0;
  for (const token of unique) {
    if (text.includes(token)) hits += 1;
  }
  return clamp(hits / unique.size);
}

function computeFitScore(project: ProjectInput, sub: SubredditInput) {
  const projectTokens = getProjectKeywords(project);
  const text = `${sub.name} ${sub.title} ${sub.description ?? ""}`;
  const semanticFit = overlapScore(projectTokens, text);
  const audienceFit = normalize(sub.activeUsers, 50_000);
  const cadenceFit = normalize(sub.avgPostsPerDay ?? 0, 150);
  return clamp(semanticFit * 0.6 + audienceFit * 0.25 + cadenceFit * 0.15);
}

function computeRiskScore(sub: SubredditInput) {
  let risk = 0.15;
  if (sub.policy?.promoAllowed === "DISALLOWED") risk += 0.45;
  else if (sub.policy?.promoAllowed === "CONTEXTUAL_ONLY") risk += 0.2;

  if (
    sub.policy?.linkPolicy === "DISALLOWED_EVERYWHERE" ||
    sub.policy?.linkPolicy === "DISALLOWED_IN_POSTS"
  ) {
    risk += 0.2;
  }
  if (sub.policy?.selfPromoAllowed === false) risk += 0.1;
  if (sub.policy?.affiliateAllowed === false) risk += 0.05;

  // Small/low-activity subs can be noisy for predictable growth.
  if (sub.activeUsers < 50) risk += 0.1;
  return clamp(risk);
}

export function rankSubreddits(
  project: ProjectInput,
  subreddits: SubredditInput[],
  limit = 5,
): RankedRecommendation[] {
  return subreddits
    .map((sub) => {
      const fitScore = computeFitScore(project, sub);
      const riskScore = computeRiskScore(sub);
      const timeScore = clamp(sub.bestTimeScore);
      const totalScore = clamp(
        fitScore * 0.55 + timeScore * 0.25 - riskScore * 0.2,
      );

      const reasons = [
        `fit=${fitScore.toFixed(2)}`,
        `risk=${riskScore.toFixed(2)}`,
        `time=${timeScore.toFixed(2)}`,
      ];
      if (sub.policy?.promoAllowed === "DISALLOWED") {
        reasons.push("strict promo policy");
      }
      if (sub.avgCommentsPerPost && sub.avgCommentsPerPost > 10) {
        reasons.push("strong comment activity");
      }
      if (sub.activeUsers > 5000) {
        reasons.push("healthy active audience");
      }

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
