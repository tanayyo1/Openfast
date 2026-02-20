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

  test("does not reward subreddits that match explicitly avoided constraints", () => {
    const ranked = rankSubreddits(
      {
        niche: "saas analytics",
        goals: { primary: "traffic" },
        constraints: { avoid: "avoid crypto and nft communities" },
      },
      [
        {
          id: "crypto",
          name: "cryptomarkets",
          title: "Crypto Markets",
          description: "Crypto and nft growth discussions",
          subscribers: 1200000,
          activeUsers: 20000,
          avgPostsPerDay: 220,
          avgCommentsPerPost: 18,
          bestTimeScore: 0.92,
          policy: {
            promoAllowed: "ALLOWED",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
        {
          id: "saas",
          name: "saas",
          title: "SaaS",
          description: "B2B saas analytics and growth",
          subscribers: 90000,
          activeUsers: 2200,
          avgPostsPerDay: 24,
          avgCommentsPerPost: 9,
          bestTimeScore: 0.7,
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

    expect(ranked[0]?.subredditId).toBe("saas");
    const crypto = ranked.find((item) => item.subredditId === "crypto");
    expect(crypto?.reasons.join(" ")).toMatch(/constraint conflict/i);
  });

  test("supports two-letter intent tokens like ai", () => {
    const ranked = rankSubreddits(
      {
        niche: "ai workflow tools",
        goals: { primary: "traffic" },
        constraints: null,
      },
      [
        {
          id: "ai",
          name: "aitools",
          title: "AI Tools",
          description: "AI automation and tool discussions",
          subscribers: 110000,
          activeUsers: 2100,
          avgPostsPerDay: 22,
          avgCommentsPerPost: 7,
          bestTimeScore: 0.7,
          policy: {
            promoAllowed: "ALLOWED",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
        {
          id: "generic",
          name: "productivity",
          title: "Productivity",
          description: "general productivity habits",
          subscribers: 110000,
          activeUsers: 2100,
          avgPostsPerDay: 22,
          avgCommentsPerPost: 7,
          bestTimeScore: 0.7,
          policy: {
            promoAllowed: "ALLOWED",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
      ],
      5,
    );

    const ai = ranked.find((item) => item.subredditId === "ai");
    const generic = ranked.find((item) => item.subredditId === "generic");
    expect(ai).toBeDefined();
    expect(generic).toBeDefined();
    expect(ai!.fitScore).toBeGreaterThan(generic!.fitScore);
  });

  test("treats unknown moderation policy as higher risk than explicit allowed policy", () => {
    const ranked = rankSubreddits(
      {
        niche: "saas conversion",
        goals: { primary: "conversion" },
        constraints: null,
      },
      [
        {
          id: "allowed",
          name: "saasgrowth",
          title: "SaaS Growth",
          description: "saas conversion growth",
          subscribers: 150000,
          activeUsers: 3000,
          avgPostsPerDay: 30,
          avgCommentsPerPost: 10,
          bestTimeScore: 0.7,
          policy: {
            promoAllowed: "ALLOWED",
            linkPolicy: "ALLOWED",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
        {
          id: "unknown",
          name: "saasbuilders",
          title: "SaaS Builders",
          description: "saas conversion growth",
          subscribers: 150000,
          activeUsers: 3000,
          avgPostsPerDay: 30,
          avgCommentsPerPost: 10,
          bestTimeScore: 0.7,
          policy: {
            promoAllowed: "UNKNOWN",
            linkPolicy: "UNKNOWN",
            selfPromoAllowed: true,
            affiliateAllowed: true,
          },
        },
      ],
      5,
    );

    const allowed = ranked.find((item) => item.subredditId === "allowed");
    const unknown = ranked.find((item) => item.subredditId === "unknown");
    expect(allowed).toBeDefined();
    expect(unknown).toBeDefined();
    expect(unknown!.riskScore).toBeGreaterThan(allowed!.riskScore);
  });
});
