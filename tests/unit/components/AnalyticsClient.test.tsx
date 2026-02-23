/**
 * @jest-environment jsdom
 */

import { trackAnalyticsEvent } from "@/lib/analytics/client";

describe("trackAnalyticsEvent", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    Object.defineProperty(global, "fetch", {
      writable: true,
      value: fetchMock,
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("sends web_public event with anonymous session id", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await trackAnalyticsEvent({
      eventName: "homepage_view",
      source: "web_public",
      onceKey: "homepage_once",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    const payload = JSON.parse(String(options.body)) as {
      events: Array<{ anonymousSessionId?: string; source: string }>;
    };
    expect(payload.events[0].source).toBe("web_public");
    expect(payload.events[0].anonymousSessionId).toBeTruthy();
  });

  test("prevents duplicate sends in same tab session for same onceKey", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await trackAnalyticsEvent({
      eventName: "onboarding_completed",
      onceKey: "same-key",
    });
    await trackAnalyticsEvent({
      eventName: "onboarding_completed",
      onceKey: "same-key",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not throw when network request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network"));

    await expect(
      trackAnalyticsEvent({
        eventName: "signup_started",
        source: "web_public",
        onceKey: "network-failure",
      }),
    ).resolves.toBeUndefined();
  });

  test("retries after a failed request for the same onceKey", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true });

    await trackAnalyticsEvent({
      eventName: "homepage_view",
      source: "web_public",
      onceKey: "retry-once-key",
    });
    await trackAnalyticsEvent({
      eventName: "homepage_view",
      source: "web_public",
      onceKey: "retry-once-key",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
