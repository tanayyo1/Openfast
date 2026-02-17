import { buildRedditProfileChecklist } from "@/lib/reddit/profileChecklist";

describe("profile checklist", () => {
  test("clamps negative persisted metrics to safe non-negative values", () => {
    const out = buildRedditProfileChecklist({
      scopes: [],
      accountAgeDays: -5,
      linkKarma: -20,
      commentKarma: -3,
      safetyTier: "NEW",
      lastSyncAt: new Date("2000-01-01T00:00:00.000Z"),
      latestHealthScore: null,
      publishedComments: -4,
      commentFirstMinComments: 3,
    });

    const combinedKarma = out.items.find((i) => i.key === "combined_karma");
    const commentKarma = out.items.find((i) => i.key === "comment_karma");
    const accountAge = out.items.find((i) => i.key === "account_age");
    const commentFirst = out.items.find((i) => i.key === "comment_first_progress");

    expect(accountAge?.detail).toContain("Account age is 0 days");
    expect(combinedKarma?.detail).toContain("Combined karma is 0");
    expect(commentKarma?.detail).toContain("Comment karma is 0");
    expect(commentFirst?.detail).toContain("Published comments: 0/3");
    expect(commentFirst?.status).toBe("FAIL");
  });

  test("treats zero comment-first requirement as already satisfied", () => {
    const out = buildRedditProfileChecklist({
      scopes: ["identity", "read", "submit"],
      accountAgeDays: 90,
      linkKarma: 100,
      commentKarma: 50,
      safetyTier: "NEW",
      lastSyncAt: new Date(),
      latestHealthScore: 80,
      publishedComments: 0,
      commentFirstMinComments: 0,
    });

    const commentFirst = out.items.find((i) => i.key === "comment_first_progress");
    expect(commentFirst?.status).toBe("PASS");
    expect(commentFirst?.detail).toContain("Published comments: 0/0");
  });
});
