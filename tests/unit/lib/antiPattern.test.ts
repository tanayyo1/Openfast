import { evaluateAntiPattern } from "@/lib/content/antiPattern";

describe("anti-pattern detection (RED-51)", () => {
  test("penalizes CTA-heavy copy", () => {
    const out = evaluateAntiPattern({
      title: "Buy now!",
      body: "Limited time offer, book a demo with ProductX.",
      projectName: "ProductX",
    });
    expect(out.penalty).toBeGreaterThan(0);
    expect(out.reasons.some((r) => r.includes("CTA"))).toBe(true);
  });

  test("ignores normal conversational copy", () => {
    const out = evaluateAntiPattern({
      title: "Shared lessons",
      body: "Here's what we tried and what worked for founders.",
      projectName: "ProductX",
    });
    expect(out.penalty).toBe(0);
    expect(out.reasons.length).toBe(0);
  });
});
