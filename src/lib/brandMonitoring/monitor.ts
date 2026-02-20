import { CandidateStatus, RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "with",
  "your",
]);

const SHORT_ALLOWED = new Set(["ai", "saas", "seo"]);

const NEGATIVE_MARKERS = [
  "problem",
  "issue",
  "broken",
  "hate",
  "failed",
  "struggl",
  "pain",
  "stuck",
  "frustrat",
  "bug",
  "slow",
  "expensive",
];

const POSITIVE_MARKERS = [
  "love",
  "best",
  "great",
  "awesome",
  "helpful",
  "recommend",
  "success",
  "improved",
  "win",
];

export type MentionSentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";
export type MentionUrgency = "LOW" | "MEDIUM" | "HIGH";

export type BrandMonitoringItem = {
  id: string;
  subredditId: string;
  subredditName: string;
  subredditTitle: string;
  title: string;
  permalink: string;
  author: string;
  status: CandidateStatus;
  opportunityScore: number;
  velocityScore: number;
  riskScore: number;
  sentiment: MentionSentiment;
  urgency: MentionUrgency;
  mentionScore: number;
  matchedKeywords: string[];
  createdAt: Date;
  expiresAt: Date;
};

export type BrandMonitoringSummary = {
  high: number;
  medium: number;
  low: number;
  positive: number;
  neutral: number;
  negative: number;
};

export type BrandMonitoringSnapshot = {
  projectId: string;
  projectName: string;
  lookbackDays: number;
  keywords: string[];
  summary: BrandMonitoringSummary;
  count: number;
  items: BrandMonitoringItem[];
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTextValues(input: unknown, out: string[], depth = 0) {
  if (depth > 4 || input == null) return;
  if (typeof input === "string") {
    if (input.trim().length > 0) out.push(input.trim());
    return;
  }
  if (Array.isArray(input)) {
    for (const value of input) collectTextValues(value, out, depth + 1);
    return;
  }
  if (typeof input === "object") {
    for (const value of Object.values(input)) {
      collectTextValues(value, out, depth + 1);
    }
  }
}

function hostCandidates(url: string | null): string[] {
  if (!url) return [];
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = host.split(".").filter(Boolean);
    const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return [host, root ?? ""].filter(Boolean);
  } catch {
    return [];
  }
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function extractBrandKeywords(input: {
  projectName: string;
  projectUrl: string | null;
  goals: unknown;
}) {
  const raw: string[] = [];
  raw.push(input.projectName);
  raw.push(...hostCandidates(input.projectUrl));
  collectTextValues(input.goals, raw);

  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    const phrase = value.trim().toLowerCase().replace(/\s+/g, " ");
    if (phrase.length >= 3 && !seen.has(phrase)) {
      seen.add(phrase);
      keywords.push(phrase);
    }

    for (const token of tokenize(value)) {
      if (STOPWORDS.has(token)) continue;
      if (token.length >= 3 || SHORT_ALLOWED.has(token)) {
        if (!seen.has(token)) {
          seen.add(token);
          keywords.push(token);
        }
      }
    }
  }

  return keywords.slice(0, 20);
}

export function detectMentionMatches(title: string, keywords: string[]) {
  const lowerTitle = title.toLowerCase();
  const matches: string[] = [];

  for (const keyword of keywords) {
    if (keyword.includes(" ")) {
      if (lowerTitle.includes(keyword)) matches.push(keyword);
      continue;
    }

    const boundary = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    if (boundary.test(title)) matches.push(keyword);
  }

  return [...new Set(matches)].slice(0, 6);
}

export function detectMentionSentiment(title: string): MentionSentiment {
  const lower = title.toLowerCase();
  const hasNegative = NEGATIVE_MARKERS.some((token) => lower.includes(token));
  const hasPositive = POSITIVE_MARKERS.some((token) => lower.includes(token));

  if (hasNegative && !hasPositive) return "NEGATIVE";
  if (hasPositive && !hasNegative) return "POSITIVE";
  return "NEUTRAL";
}

export function computeMentionUrgency(input: {
  sentiment: MentionSentiment;
  opportunityScore: number;
  velocityScore: number;
  matchCount: number;
}): { urgency: MentionUrgency; score: number } {
  let score = 0;
  if (input.sentiment === "NEGATIVE") score += 2;
  else if (input.sentiment === "NEUTRAL") score += 1;

  if (input.opportunityScore >= 0.75) score += 2;
  else if (input.opportunityScore >= 0.5) score += 1;

  if (input.velocityScore >= 0.67) score += 2;
  else if (input.velocityScore >= 0.34) score += 1;

  if (input.matchCount >= 2) score += 1;

  if (score >= 6) return { urgency: "HIGH", score };
  if (score >= 3) return { urgency: "MEDIUM", score };
  return { urgency: "LOW", score };
}

function summaryFromItems(items: BrandMonitoringItem[]): BrandMonitoringSummary {
  const summary: BrandMonitoringSummary = {
    high: 0,
    medium: 0,
    low: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  for (const item of items) {
    if (item.urgency === "HIGH") summary.high += 1;
    else if (item.urgency === "MEDIUM") summary.medium += 1;
    else summary.low += 1;

    if (item.sentiment === "NEGATIVE") summary.negative += 1;
    else if (item.sentiment === "POSITIVE") summary.positive += 1;
    else summary.neutral += 1;
  }
  return summary;
}

export async function buildProjectBrandMonitoringSnapshot(input: {
  workspaceId: string;
  projectId: string;
  lookbackDays: number;
  limit: number;
}): Promise<BrandMonitoringSnapshot | null> {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      workspaceId: input.workspaceId,
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      name: true,
      url: true,
      goals: true,
    },
  });
  if (!project) return null;

  const keywords = extractBrandKeywords({
    projectName: project.name,
    projectUrl: project.url,
    goals: project.goals,
  });
  const recommendationScope = await prisma.projectSubredditRecommendation.findMany({
    where: {
      workspaceId: input.workspaceId,
      projectId: project.id,
      status: { in: [RecommendationStatus.SELECTED, RecommendationStatus.CANDIDATE] },
    },
    select: { subredditId: true },
    orderBy: [{ status: "asc" }, { compositeScore: "desc" }],
    take: 20,
  });

  if (recommendationScope.length === 0) {
    return {
      projectId: project.id,
      projectName: project.name,
      lookbackDays: input.lookbackDays,
      keywords,
      summary: summaryFromItems([]),
      count: 0,
      items: [],
    };
  }

  const since = new Date(Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.threadCandidate.findMany({
    where: {
      subredditId: { in: recommendationScope.map((item) => item.subredditId) },
      status: { in: [CandidateStatus.ACTIVE, CandidateStatus.EXPIRED, CandidateStatus.USED] },
      createdAt: { gte: since },
    },
    include: {
      subreddit: {
        select: { id: true, name: true, title: true },
      },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: Math.max(25, Math.min(input.limit * 5, 200)),
  });

  const rankedItems: BrandMonitoringItem[] = [];
  for (const item of candidates) {
    const matchedKeywords = detectMentionMatches(item.title, keywords);
    if (matchedKeywords.length === 0) continue;
    const sentiment = detectMentionSentiment(item.title);
    const urgency = computeMentionUrgency({
      sentiment,
      opportunityScore: item.score,
      velocityScore: item.velocityScore,
      matchCount: matchedKeywords.length,
    });
    rankedItems.push({
      id: item.id,
      subredditId: item.subredditId,
      subredditName: item.subreddit.name,
      subredditTitle: item.subreddit.title,
      title: item.title,
      permalink: item.permalink,
      author: item.author,
      status: item.status,
      opportunityScore: item.score,
      velocityScore: item.velocityScore,
      riskScore: item.riskScore,
      sentiment,
      urgency: urgency.urgency,
      mentionScore: urgency.score,
      matchedKeywords,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
    });
  }

  const urgencyWeight: Record<MentionUrgency, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  const items = rankedItems
    .sort((a, b) => {
      const byUrgency = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (byUrgency !== 0) return byUrgency;
      const byScore = b.mentionScore - a.mentionScore;
      if (byScore !== 0) return byScore;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, input.limit);

  return {
    projectId: project.id,
    projectName: project.name,
    lookbackDays: input.lookbackDays,
    keywords,
    summary: summaryFromItems(items),
    count: items.length,
    items,
  };
}
