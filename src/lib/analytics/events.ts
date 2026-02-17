export const ANALYTICS_EVENT_NAMES = [
  "homepage_view",
  "signup_started",
  "signup_completed",
  "onboarding_completed",
  "plan_activated",
] as const;

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);

export function isAllowedAnalyticsEventName(eventName: string) {
  return (
    EVENT_NAME_SET.has(eventName) || eventName.startsWith("onboarding_step_")
  );
}

export function requiresWorkspaceContext(eventName: string) {
  return (
    eventName === "onboarding_completed" ||
    eventName === "plan_activated" ||
    eventName.startsWith("onboarding_step_")
  );
}
