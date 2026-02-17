describe("analyticsClient", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test("posts events when enabled", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { analytics } = await import("@/lib/analyticsClient");
    await analytics.trackHomepageView();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      events: Array<{ eventName: string }>;
    };
    expect(payload.events[0]?.eventName).toBe("homepage_view");
  });

  test("no-ops when disabled", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false";
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { analytics } = await import("@/lib/analyticsClient");
    await analytics.trackSignupStarted();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("gracefully handles fetch errors", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    const fetchMock = jest.fn().mockRejectedValue(new Error("network"));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { analytics } = await import("@/lib/analyticsClient");

    await expect(
      analytics.trackOnboardingStep("create_project"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
