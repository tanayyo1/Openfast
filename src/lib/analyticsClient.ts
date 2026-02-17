type AnalyticsSource = "web_public" | "web_app" | "server";

type AnalyticsEventPayload = {
  eventName: string;
  source: AnalyticsSource;
  page?: string;
  userId?: string;
  workspaceId?: string;
  anonymousSessionId?: string;
  properties?: Record<string, unknown>;
  occurredAt?: string;
};

const ANALYTICS_ENDPOINT = "/api/analytics/events";

function resolveAnalyticsEnabled() {
  const explicit = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;

  if (explicit === "true") return true;
  if (explicit === "false") return false;

  return process.env.NODE_ENV !== "production";
}

function buildAnonymousSessionId() {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function detectPage() {
  if (typeof window === "undefined") return undefined;
  return window.location.pathname;
}

export async function trackEvent(payload: AnalyticsEventPayload) {
  if (!resolveAnalyticsEnabled()) return;
  if (typeof fetch !== "function") return;

  try {
    await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            eventName: payload.eventName,
            source: payload.source,
            page: payload.page ?? detectPage(),
            userId: payload.userId,
            workspaceId: payload.workspaceId,
            anonymousSessionId:
              payload.anonymousSessionId ?? buildAnonymousSessionId(),
            properties: payload.properties ?? {},
            occurredAt: payload.occurredAt ?? new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    return;
  }
}

export const analytics = {
  trackHomepageView() {
    return trackEvent({ eventName: "homepage_view", source: "web_public" });
  },
  trackSignupStarted() {
    return trackEvent({ eventName: "signup_started", source: "web_public" });
  },
  trackSignupCompleted(userId?: string) {
    return trackEvent({
      eventName: "signup_completed",
      source: "web_public",
      userId,
    });
  },
  trackOnboardingStep(stepName: string, properties?: Record<string, unknown>) {
    return trackEvent({
      eventName: `onboarding_step_${stepName}`,
      source: "web_app",
      properties,
    });
  },
  trackOnboardingCompleted(properties?: Record<string, unknown>) {
    return trackEvent({
      eventName: "onboarding_completed",
      source: "web_app",
      properties,
    });
  },
  trackPlanActivated(planId: string, price?: string) {
    return trackEvent({
      eventName: "plan_activated",
      source: "web_public",
      properties: {
        planId,
        price,
      },
    });
  },
};
