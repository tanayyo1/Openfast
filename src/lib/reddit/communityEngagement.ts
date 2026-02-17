type CountPublishedComments = (input: {
  workspaceId: string;
  redditAccountId: string;
  subredditId: string;
}) => Promise<number>;

const DEFAULT_MIN_COMMENTS = 2;

function parseNonNegativeEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 0) return fallback;
  return Math.floor(raw);
}

export function getCommunityEngagementThreshold() {
  return parseNonNegativeEnvInt(
    "COMMUNITY_ENGAGEMENT_MIN_COMMENTS",
    DEFAULT_MIN_COMMENTS,
  );
}

export async function evaluateCommunityEngagementThreshold(
  input: {
    workspaceId: string;
    redditAccountId: string;
    subredditId: string;
  },
  countPublishedComments: CountPublishedComments,
) {
  const requiredComments = getCommunityEngagementThreshold();
  if (requiredComments <= 0) {
    return {
      enabled: false,
      requiredComments,
      publishedComments: 0,
      remainingComments: 0,
      met: true,
    };
  }

  const publishedComments = await countPublishedComments(input);
  const remainingComments = Math.max(0, requiredComments - publishedComments);
  return {
    enabled: true,
    requiredComments,
    publishedComments,
    remainingComments,
    met: publishedComments >= requiredComments,
  };
}
