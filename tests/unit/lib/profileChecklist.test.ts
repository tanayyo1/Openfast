import { buildRedditProfileChecklist } from "@/lib/reddit/profileChecklist";

describe("profile checklist", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousWarningThreshold = env.PROFILE_CHECKLIST_MAX_WARNINGS_FOR_READY;

  afterEach(() => {
    if (previousWarningThreshold === undefined) {
      delete env.PROFILE_CHECKLIST_MAX_WARNINGS_FOR_READY;
    } else {
      env.PROFILE_CHECKLIST_MAX_WARNINGS_FOR_READY = previousWarningThreshold;
    }
  });

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
    const commentFirst = out.items.find(
      (i) => i.key === "comment_first_progress",
    );

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

    const commentFirst = out.items.find(
      (i) => i.key === "comment_first_progress",
    );
    expect(commentFirst?.status).toBe("PASS");
    expect(commentFirst?.detail).toContain("Published comments: 0/0");
  });

  test("supports readiness warning threshold override", () => {
    env.PROFILE_CHECKLIST_MAX_WARNINGS_FOR_READY = "3";

    const out = buildRedditProfileChecklist({
      scopes: [],
      accountAgeDays: 1,
      linkKarma: 0,
      commentKarma: 0,
      safetyTier: "ESTABLISHED",
      lastSyncAt: new Date("2000-01-01T00:00:00.000Z"),
      latestHealthScore: null,
      publishedComments: 0,
      commentFirstMinComments: 0,
    });

    expect(out.summary.failed).toBe(1);
    expect(out.readiness).toBe("NOT_READY");

    const readyCandidate = buildRedditProfileChecklist({
      scopes: ["identity", "read", "submit"],
      accountAgeDays: 1, // warn
      linkKarma: 0, // warn
      commentKarma: 0, // warn
      safetyTier: "ESTABLISHED",
      lastSyncAt: new Date(), // pass
      latestHealthScore: 80, // pass
      publishedComments: 0, // pass for non-NEW
      commentFirstMinComments: 0,
    });

    expect(readyCandidate.summary.warned).toBe(3);
    expect(readyCandidate.readiness).toBe("READY");
  });

  test("normalizes scope casing and trims whitespace before validation", () => {
    const out = buildRedditProfileChecklist({
      scopes: [" Identity ", "READ", " submit "],
      accountAgeDays: 40,
      linkKarma: 60,
      commentKarma: 30,
      safetyTier: "ESTABLISHED",
      lastSyncAt: new Date(),
      latestHealthScore: 70,
      publishedComments: 0,
      commentFirstMinComments: 3,
    });

    const requiredScopes = out.items.find(
      (item) => item.key === "required_scopes",
    );
    expect(requiredScopes?.status).toBe("PASS");
  });
});
