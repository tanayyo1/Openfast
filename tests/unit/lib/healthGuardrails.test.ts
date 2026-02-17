import { getHealthGuardrailThresholds } from "@/lib/health/guardrails";

describe("health guardrail thresholds", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousBlock = env.HEALTH_BLOCK_THRESHOLD;
  const previousCaution = env.HEALTH_CAUTION_THRESHOLD;

  afterEach(() => {
    if (previousBlock === undefined) {
      delete env.HEALTH_BLOCK_THRESHOLD;
    } else {
      env.HEALTH_BLOCK_THRESHOLD = previousBlock;
    }
    if (previousCaution === undefined) {
      delete env.HEALTH_CAUTION_THRESHOLD;
    } else {
      env.HEALTH_CAUTION_THRESHOLD = previousCaution;
    }
  });

  test("uses defaults when env is missing", () => {
    delete env.HEALTH_BLOCK_THRESHOLD;
    delete env.HEALTH_CAUTION_THRESHOLD;
    expect(getHealthGuardrailThresholds()).toEqual({
      blockPublishing: 30,
      caution: 45,
    });
  });

  test("prevents inverted thresholds when caution is <= block", () => {
    env.HEALTH_BLOCK_THRESHOLD = "40";
    env.HEALTH_CAUTION_THRESHOLD = "35";
    expect(getHealthGuardrailThresholds()).toEqual({
      blockPublishing: 40,
      caution: 41,
    });
  });
});
