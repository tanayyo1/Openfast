export type RecommendationSignal = {
  fitScore: number;
  riskScore: number;
  timeWindowScore: number;
  status: "CANDIDATE" | "SELECTED" | "DISMISSED";
  subreddit: {
    subscribers: number | null;
    activeUsers: number | null;
    avgCommentsPerPost: number | null;
  };
};

export type PainPointSignal = {
  severityScore: number;
  confidenceScore: number;
  frequency: number;
};

export type DemandScorecardInput = {
  recommendations: RecommendationSignal[];
  painPoints: PainPointSignal[];
};

type MarketTier = "UNKNOWN" | "HIGH" | "MEDIUM" | "EARLY";

export type DemandScorecardResult = {
  overallDemandScore: number;
  marketTier: MarketTier;
  coverage: {
    recommendations: number;
    selectedRecommendations: number;
    painPoints: number;
  };
  components: {
    fit: number;
    audience: number;
    timing: number;
    safety: number;
    painIntensity: number;
  };
  blockers: string[];
  opportunities: string[];
};

function clamp(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function toPct(value: number) {
  return Math.round(clamp(value) * 100);
}

function normalizeAudience(signal: RecommendationSignal) {
  const subscribers = clamp((signal.subreddit.subscribers ?? 0) / 500_000);
  const activeUsers = clamp((signal.subreddit.activeUsers ?? 0) / 5_000);
  const comments = clamp((signal.subreddit.avgCommentsPerPost ?? 0) / 20);
  return average([subscribers, activeUsers, comments]);
}

export function buildDemandScorecard(
  input: DemandScorecardInput,
): DemandScorecardResult {
  const selected = input.recommendations.filter((item) => item.status === "SELECTED");
  const candidatePool = selected.length > 0 ? selected : input.recommendations;

  if (candidatePool.length === 0) {
    return {
      overallDemandScore: 0,
      marketTier: "UNKNOWN" as const,
      coverage: {
        recommendations: 0,
        selectedRecommendations: 0,
        painPoints: input.painPoints.length,
      },
      components: {
        fit: 0,
        audience: 0,
        timing: 0,
        safety: 0,
        painIntensity: 0,
      },
      blockers: [
        "Generate subreddit recommendations first.",
        "Select target subreddits before using demand scorecard insights.",
      ],
      opportunities: [],
    };
  }

  const fitScore = average(candidatePool.map((item) => clamp(item.fitScore)));
  const riskScore = average(candidatePool.map((item) => clamp(item.riskScore)));
  const timingScore = average(
    candidatePool.map((item) => clamp(item.timeWindowScore)),
  );
  const audienceScore = average(candidatePool.map(normalizeAudience));

  const painSeverity = average(
    input.painPoints.map((item) => clamp(item.severityScore)),
  );
  const painConfidence = average(
    input.painPoints.map((item) => clamp(item.confidenceScore)),
  );
  const rawFrequencies = input.painPoints.map((item) => item.frequency);
  // Keep the original baseline (4) but scale up for projects with higher-frequency pain points.
  const normalizationDivisor = Math.max(
    4,
    rawFrequencies.length > 0 ? Math.max(...rawFrequencies) : 0,
  );
  const painFrequency = clamp(
    (rawFrequencies.length > 0 ? average(rawFrequencies) : 0) /
      Math.max(normalizationDivisor, 1),
  );
  const painIntensity = clamp(
    painSeverity * 0.45 + painFrequency * 0.35 + painConfidence * 0.2,
  );

  const safetyScore = clamp(1 - riskScore);
  const overall = clamp(
    fitScore * 0.3 +
      audienceScore * 0.2 +
      timingScore * 0.15 +
      safetyScore * 0.15 +
      painIntensity * 0.2,
  );

  const blockers: string[] = [];
  const opportunities: string[] = [];

  if (selected.length === 0) {
    blockers.push(
      "No subreddits selected yet. Prioritize 2-4 high-fit communities first.",
    );
  }
  if (riskScore > 0.6) {
    blockers.push(
      "Average recommendation risk is high. Focus on safer subreddits before scaling posts.",
    );
  }
  if (input.painPoints.length < 3) {
    blockers.push(
      "Pain-point coverage is shallow. Extract more project pain points for stronger demand signals.",
    );
  }

  if (fitScore >= 0.7) {
    opportunities.push("Strong niche-fit signal across target subreddits.");
  }
  if (painIntensity >= 0.65) {
    opportunities.push(
      "Pain-point intensity is high. Lead with problem-first content hooks.",
    );
  }
  if (timingScore >= 0.65) {
    opportunities.push(
      "Posting-time potential is strong. Schedule launches in top windows.",
    );
  }

  const marketTier =
    overall >= 0.75
      ? ("HIGH" as const)
      : overall >= 0.55
        ? ("MEDIUM" as const)
        : ("EARLY" as const);

  return {
    overallDemandScore: toPct(overall),
    marketTier,
    coverage: {
      recommendations: input.recommendations.length,
      selectedRecommendations: selected.length,
      painPoints: input.painPoints.length,
    },
    components: {
      fit: toPct(fitScore),
      audience: toPct(audienceScore),
      timing: toPct(timingScore),
      safety: toPct(safetyScore),
      painIntensity: toPct(painIntensity),
    },
    blockers,
    opportunities,
  };
}
