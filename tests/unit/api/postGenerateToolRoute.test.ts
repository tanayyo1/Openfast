jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: jest.fn(),
}));

jest.mock("@/lib/rateLimit/publicTools", () => ({
  enforcePublicToolRateLimit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subredditCatalog: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@/lib/subreddit/rulesFetchCache", () => ({
  fetchSubredditDataWithCache: jest.fn(),
}));

import { POST as postGenerateTool } from "@/app/api/tools/post-generate/route";
import { fetchSubredditDataWithCache } from "@/lib/subreddit/rulesFetchCache";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireSession: jest.Mock;
};
const mockedRateLimit = jest.requireMock("@/lib/rateLimit/publicTools") as {
  enforcePublicToolRateLimit: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  subredditCatalog: { findFirst: jest.Mock };
};
const mockedFetchSubredditDataWithCache =
  fetchSubredditDataWithCache as jest.Mock;

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("post-generate tool route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireSession.mockRejectedValue(new Error("UNAUTHORIZED"));
    mockedRateLimit.enforcePublicToolRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAfterSeconds: 60,
    });
    mockedPrisma.subredditCatalog.findFirst.mockResolvedValue(null);
    mockedFetchSubredditDataWithCache.mockResolvedValue({
      data: {
        name: "startups",
        title: "Startups",
        description: "Startup discussions",
        subscribers: 1000,
        activeUsers: 100,
        nsfw: false,
        isRestricted: false,
        isQuarantined: false,
        avgPostsPerDay: 10,
        avgCommentsPerPost: 5,
        rules: ["No links in posts", "Flair required", "No self-promo"],
      },
      source: "fallback",
    });
  });

  test("uses fetched subreddit rules to return generated variants and risk", async () => {
    const res = await postGenerateTool(
      new Request("http://test.local/api/tools/post-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "onboarding experiments",
          product: "ReditFast",
          audience: "founders",
          tone: "helpful",
          subreddit: "r/startups",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      draft: { title: string | null; body: string };
      variants: Array<{ title: string | null; body: string }>;
      risk: { riskScore: number; riskReasons: string[] };
      policyHints: { linkPolicy: string; flairRequired: boolean };
      subredditRulesPreview: string[];
    };

    expect(json.draft.title).toContain("onboarding experiments");
    expect(json.variants.length).toBeGreaterThanOrEqual(3);
    expect(json.risk.riskScore).toEqual(expect.any(Number));
    expect(json.policyHints.linkPolicy).toBe("DISALLOWED_IN_POSTS");
    expect(json.policyHints.flairRequired).toBe(true);
    expect(json.subredditRulesPreview[0]).toContain("No links in posts");
    expect(mockedFetchSubredditDataWithCache).toHaveBeenCalledWith("startups");
  });
});
