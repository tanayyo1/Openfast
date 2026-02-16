import {
  classifyTone,
  evaluateToneAlignment,
  normalizeExpectedTone,
} from "@/lib/content/toneClassifier";

describe("tone classifier (RED-53)", () => {
  test("normalizes tone aliases", () => {
    expect(normalizeExpectedTone("formal")).toBe("professional");
    expect(normalizeExpectedTone("conversational")).toBe("friendly");
    expect(normalizeExpectedTone("unknown")).toBe("neutral");
  });

  test("classifies direct content", () => {
    const out = classifyTone({
      title: "Here is the process",
      body: "First do this. Next avoid noisy calls to action.",
    });

    expect(out.tone).toBe("direct");
    expect(out.confidence).toBeGreaterThanOrEqual(40);
  });

  test("applies penalty on tone mismatch", () => {
    const out = evaluateToneAlignment({
      expectedTone: "professional",
      title: "Hey folks",
      body: "I'm gonna share a quick casual update lol.",
    });

    expect(out.expectedTone).toBe("professional");
    expect(out.detectedTone).toBe("casual");
    expect(out.penalty).toBeGreaterThan(0);
    expect(out.reasons.length).toBeGreaterThan(0);
    expect(out.fixes.length).toBeGreaterThan(0);
  });

  test("keeps penalty zero when neutral tone is expected", () => {
    const out = evaluateToneAlignment({
      expectedTone: "neutral",
      title: "Quick update",
      body: "We tested this and saw stable results.",
    });

    expect(out.penalty).toBe(0);
  });
});
