import { syncRedditAdCampaign } from "@/lib/redditAds/externalSync";

describe("reddit ads external sync", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.REDDIT_ADS_SYNC_MODE;
    delete process.env.REDDIT_ADS_SYNC_ENDPOINT;
    delete process.env.REDDIT_ADS_SYNC_API_KEY;
    delete process.env.REDDIT_ADS_SYNC_TIMEOUT_MS;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const campaign = {
    id: "cmp_1",
    workspaceId: "ws_1",
    redditAccountId: "ra_1",
    name: "Launch",
    objective: "TRAFFIC" as const,
    status: "ACTIVE" as const,
    dailyBudgetCents: 2500,
    lifetimeBudgetCents: 10000,
    startAt: new Date("2026-02-21T00:00:00.000Z"),
    endAt: new Date("2026-03-01T00:00:00.000Z"),
    targetSubreddits: ["startups"],
    targetCountries: ["US"],
    interests: null,
    headline: "Try it",
    body: "Body",
    destinationUrl: "https://example.com",
    ctaText: "Get started",
    externalCampaignId: null,
  };

  test("uses deterministic mock external id when webhook mode is not configured", async () => {
    const out = await syncRedditAdCampaign({
      campaign,
      action: "UPSERT",
      version: "2026-02-21T10:00:00.000Z",
    });

    expect(out.remoteStatus).toBe("ACTIVE");
    expect(out.externalCampaignId).toMatch(/^mock_/);
  });

  test("webhook mode requires endpoint", async () => {
    process.env.REDDIT_ADS_SYNC_MODE = "webhook";

    await expect(
      syncRedditAdCampaign({
        campaign,
        action: "UPSERT",
        version: "2026-02-21T10:00:00.000Z",
      }),
    ).rejects.toThrow("EXTERNAL_SYNC_CONFIG_MISSING_ENDPOINT");
  });

  test("webhook mode uses external campaign id from provider response", async () => {
    process.env.REDDIT_ADS_SYNC_MODE = "webhook";
    process.env.REDDIT_ADS_SYNC_ENDPOINT =
      "https://sync.example.com/reddit-ads";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        externalCampaignId: "ext_123",
        status: "ACTIVE",
      }),
    } as unknown as Response);

    const out = await syncRedditAdCampaign({
      campaign,
      action: "UPSERT",
      version: "2026-02-21T10:00:00.000Z",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(out.externalCampaignId).toBe("ext_123");
    expect(out.remoteStatus).toBe("ACTIVE");
  });
});
