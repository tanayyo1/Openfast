import {
  accountTierSafetySignal,
  queueHealthSafetySignal,
} from "@/lib/safetySignals";

describe("safety signals", () => {
  test("maps account tiers to actionable safety signals", () => {
    expect(accountTierSafetySignal("NEW")).toEqual(
      expect.objectContaining({
        level: "watch",
        label: "Comment-first",
      }),
    );
    expect(accountTierSafetySignal("RESTRICTED")).toEqual(
      expect.objectContaining({
        level: "blocked",
        label: "Restricted",
      }),
    );
    expect(accountTierSafetySignal("TRUSTED")).toEqual(
      expect.objectContaining({
        level: "safe",
        label: "Trusted",
      }),
    );
    expect(accountTierSafetySignal("unexpected_tier")).toEqual(
      expect.objectContaining({
        level: "watch",
        label: "Tier unknown",
      }),
    );
  });

  test("maps queue health levels to safety signals", () => {
    expect(queueHealthSafetySignal("OK")).toEqual(
      expect.objectContaining({
        level: "safe",
        label: "Queue healthy",
      }),
    );
    expect(queueHealthSafetySignal("WARNING")).toEqual(
      expect.objectContaining({
        level: "watch",
        label: "Queue caution",
      }),
    );
    expect(queueHealthSafetySignal("CRITICAL")).toEqual(
      expect.objectContaining({
        level: "blocked",
        label: "Queue risk",
      }),
    );
    expect(queueHealthSafetySignal(null)).toEqual(
      expect.objectContaining({
        level: "watch",
        label: "Queue unknown",
      }),
    );
  });
});
