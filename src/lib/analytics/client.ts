"use client";

type AnalyticsSource = "web_public" | "web_app" | "server";

type TrackAnalyticsEventInput = {
  eventName: string;
  source?: AnalyticsSource;
  page?: string;
  properties?: Record<string, unknown>;
  onceKey?: string;
};

const ANON_SESSION_KEY = "rf_anon_session_id";
const ONCE_KEY_PREFIX = "rf_analytics_once";
const pendingOnceKeys = new Set<string>();

function createAnonymousSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getAnonymousSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(ANON_SESSION_KEY);
    if (existing) return existing;
    const created = createAnonymousSessionId();
    window.localStorage.setItem(ANON_SESSION_KEY, created);
    return created;
  } catch {
    return null;
  }
}

function onceGuardKey(input: TrackAnalyticsEventInput) {
  if (input.onceKey) return `${ONCE_KEY_PREFIX}:${input.onceKey}`;
  if (typeof window === "undefined") return null;
  return `${ONCE_KEY_PREFIX}:${input.eventName}:${window.location.pathname}`;
}

function wasSentThisSession(key: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSentThisSession(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput) {
  if (typeof window === "undefined") return;

  const source = input.source ?? "web_app";
  const key = onceGuardKey(input);
  if (key && (wasSentThisSession(key) || pendingOnceKeys.has(key))) {
    return;
  }

  const payloadEvent: {
    eventName: string;
    source: AnalyticsSource;
    page?: string;
    properties?: Record<string, unknown>;
    anonymousSessionId?: string;
  } = {
    eventName: input.eventName,
    source,
    page: input.page ?? window.location.pathname,
    properties: input.properties,
  };

  if (source === "web_public") {
    const anonymousSessionId = getAnonymousSessionId();
    if (!anonymousSessionId) return;
    payloadEvent.anonymousSessionId = anonymousSessionId;
  }

  if (key) pendingOnceKeys.add(key);

  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [payloadEvent] }),
      keepalive: true,
    });
    if (key && response.ok) {
      markSentThisSession(key);
    }
  } catch {
    // Analytics capture should never block user actions.
  } finally {
    if (key) pendingOnceKeys.delete(key);
  }
}
