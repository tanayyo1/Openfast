export type SafetySignalLevel = "safe" | "watch" | "blocked";

export type AccountTier =
  | "NEW"
  | "WARM"
  | "ESTABLISHED"
  | "TRUSTED"
  | "RESTRICTED";

export type SafetySignal = {
  level: SafetySignalLevel;
  label: string;
  note: string;
};

export function accountTierSafetySignal(tier: string): SafetySignal {
  const normalized =
    typeof tier === "string" ? tier.toUpperCase() : "ESTABLISHED";
  const typedTier = normalized as AccountTier;

  if (typedTier === "RESTRICTED") {
    return {
      level: "blocked",
      label: "Restricted",
      note: "Comments only until account risk recovers.",
    };
  }
  if (typedTier === "NEW") {
    return {
      level: "watch",
      label: "Comment-first",
      note: "Build comment history before scaling post cadence.",
    };
  }
  if (typedTier === "WARM") {
    return {
      level: "watch",
      label: "Warm-up",
      note: "Post conservatively while account reputation stabilizes.",
    };
  }
  if (typedTier === "TRUSTED") {
    return {
      level: "safe",
      label: "Trusted",
      note: "Healthy posting cadence available with normal monitoring.",
    };
  }
  if (typedTier === "ESTABLISHED") {
    return {
      level: "safe",
      label: "Established",
      note: "Balanced posting cadence available with standard guardrails.",
    };
  }
  return {
    level: "watch",
    label: "Tier unknown",
    note: "Account tier is unavailable. Use conservative pacing until refreshed.",
  };
}

export function queueHealthSafetySignal(level: string | null): SafetySignal {
  if (level === "CRITICAL") {
    return {
      level: "blocked",
      label: "Queue risk",
      note: "Publishing queue is critical. Resolve worker backlog before scaling.",
    };
  }
  if (level === "WARNING") {
    return {
      level: "watch",
      label: "Queue caution",
      note: "Queue has warning signals. Monitor retries and overdue items.",
    };
  }
  if (level === "OK") {
    return {
      level: "safe",
      label: "Queue healthy",
      note: "No worker-side safety issues detected.",
    };
  }
  return {
    level: "watch",
    label: "Queue unknown",
    note: "Queue health unavailable. Validate worker status before scheduling.",
  };
}
