import { rankSubreddits } from "@/lib/recommendations/ranking";

describe("rankSubreddits", () => {
  test("returns top 5 ordered by weighted total", () => {
    const ranked = rankSubreddits(
      {
        niche: "saas marketing",
        goals: { primary: "traffic" },
        constraints: null,
      },
      [
        {
          id: "1",
          name: "saas",
          title: "SaaS",
          description: "SaaS growth and distribution",
          subscribers: 100000,
          activeUsers: 800,
          avgPostsPerDay: 25,
          avgCommentsPerPost: 8,
          bestTimeScore: 0.9,
          policy: {
            promoAllowed: "CONTEXTUAL_ONLY",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
        {
          id: "2",
          name: "startups",
          title: "Startups",
          description: "startup launch and growth",
          subscribers: 1000000,
          activeUsers: 6000,
          avgPostsPerDay: 90,
          avgCommentsPerPost: 15,
          bestTimeScore: 0.7,
          policy: {
            promoAllowed: "ALLOWED",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
        {
          id: "3",
          name: "strict",
          title: "Strict Sub",
          description: "strict moderation",
          subscribers: 80000,
          activeUsers: 300,
          avgPostsPerDay: 12,
          avgCommentsPerPost: 3,
          bestTimeScore: 0.8,
          policy: {
            promoAllowed: "DISALLOWED",
            linkPolicy: "DISALLOWED_EVERYWHERE",
            selfPromoAllowed: false,
            affiliateAllowed: false,
          },
        },
      ],
      5,
    );

    expect(ranked.length).toBe(3);
    expect(ranked[2].subredditId).toBe("3");
    expect(ranked[2].riskScore).toBeGreaterThan(ranked[0].riskScore);
    expect(ranked[0].totalScore).toBeGreaterThanOrEqual(ranked[1].totalScore);
    expect(ranked[1].totalScore).toBeGreaterThanOrEqual(ranked[2].totalScore);
    expect(ranked[0].reasons[0]).toMatch(/Niche match/i);
    expect(ranked[0].reasons.join(" ")).toMatch(/Goal alignment/i);
  });

  test("caps result length to requested limit", () => {
    const base = {
      title: "x",
      description: "x",
      subscribers: 1000,
      activeUsers: 100,
      avgPostsPerDay: 5,
      avgCommentsPerPost: 3,
      bestTimeScore: 0.4,
      policy: null,
    };
    const subreddits = Array.from({ length: 8 }).map((_, i) => ({
      ...base,
      id: `${i}`,
      name: `sub_${i}`,
    }));
    const ranked = rankSubreddits(
      { niche: "test", goals: {}, constraints: {} },
      subreddits,
      5,
    );
    expect(ranked).toHaveLength(5);
  });

  test("penalizes broad high-traffic subreddits when niche fit is weak", () => {
    const ranked = rankSubreddits(
      {
        niche: "b2b compliance automation",
        goals: { primary: "conversion" },
        constraints: null,
      },
      [
        {
          id: "broad",
          name: "askreddit",
          title: "AskReddit",
          description: "Ask and answer thought provoking questions.",
          subscribers: 40000000,
          activeUsers: 120000,
          avgPostsPerDay: 1200,
          avgCommentsPerPost: 30,
          bestTimeScore: 0.95,
          policy: {
            promoAllowed: "ALLOWED",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
        {
          id: "niche",
          name: "b2bmarketing",
          title: "B2B Marketing",
          description: "B2B SaaS marketing and revenue operations",
          subscribers: 50000,
          activeUsers: 1200,
          avgPostsPerDay: 25,
          avgCommentsPerPost: 9,
          bestTimeScore: 0.75,
          policy: {
            promoAllowed: "CONTEXTUAL_ONLY",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
      ],
      5,
    );

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.subredditId).toBe("niche");
    const broad = ranked.find((item) => item.subredditId === "broad");
    expect(broad).toBeDefined();
    expect(broad?.reasons.join(" ")).toMatch(/broad-audience penalty/i);
  });
});
