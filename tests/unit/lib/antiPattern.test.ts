import { evaluateAntiPattern } from "@/lib/content/antiPattern";

describe("anti pattern detector", () => {
  test("flags vote manipulation language", () => {
    const out = evaluateAntiPattern({
      title: "Quick ask",
      body: "Please upvote this if you agree with the tip.",
    });

    expect(out.penalty).toBeGreaterThan(0);
    expect(out.flags).toContain("vote_manipulation");
    expect(out.reasons.length).toBeGreaterThan(0);
    expect(out.fixes.length).toBeGreaterThan(0);
  });

  test("flags gated engagement prompts", () => {
    const out = evaluateAntiPattern({
      title: null,
      body: "Comment 'template' and I'll DM me for the full framework.",
    });

    expect(out.flags).toContain("engagement_gating");
    expect(out.penalty).toBeGreaterThanOrEqual(7);
  });

  test("returns zero penalty for clean educational content", () => {
    const out = evaluateAntiPattern({
      title: "How we reduced churn",
      body:
        "We tested onboarding changes over three weeks and share what worked, " +
        "what failed, and the tradeoffs teams should expect.",
    });

    expect(out.penalty).toBe(0);
    expect(out.flags).toEqual([]);
    expect(out.reasons).toEqual([]);
  });

  test("caps anti-pattern penalty", () => {
    const out = evaluateAntiPattern({
      title: "Please upvote",
      body:
        "Please upvote this. Help me get karma. DM me for the full template. " +
        "Edit: thanks for the upvotes and awards. " +
        "This repeated sentence is intentionally long enough to trigger detection. " +
        "This repeated sentence is intentionally long enough to trigger detection.",
    });

    expect(out.penalty).toBe(20);
  });
});
