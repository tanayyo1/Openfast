import {
  evaluateCommunityEngagementThreshold,
  getCommunityEngagementThreshold,
} from "@/lib/reddit/communityEngagement";

describe("community engagement threshold", () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;

  afterEach(() => {
    if (previous === undefined) {
      delete env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS;
    } else {
      env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = previous;
    }
  });

  test("falls back to default threshold on invalid env value", () => {
    env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "not-a-number";
    expect(getCommunityEngagementThreshold()).toBe(2);
  });

  test("disables enforcement when threshold is zero", async () => {
    env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "0";
    const countFn = jest.fn().mockResolvedValue(99);

    const out = await evaluateCommunityEngagementThreshold(
      {
        workspaceId: "ws_1",
        redditAccountId: "ra_1",
        subredditId: "sub_1",
      },
      countFn,
    );

    expect(out.enabled).toBe(false);
    expect(out.met).toBe(true);
    expect(out.remainingComments).toBe(0);
    expect(countFn).not.toHaveBeenCalled();
  });

  test("returns unmet details including remaining comments", async () => {
    env.COMMUNITY_ENGAGEMENT_MIN_COMMENTS = "3";
    const out = await evaluateCommunityEngagementThreshold(
      {
        workspaceId: "ws_1",
        redditAccountId: "ra_1",
        subredditId: "sub_1",
      },
      async () => 1,
    );

    expect(out.enabled).toBe(true);
    expect(out.requiredComments).toBe(3);
    expect(out.publishedComments).toBe(1);
    expect(out.remainingComments).toBe(2);
    expect(out.met).toBe(false);
  });
});
