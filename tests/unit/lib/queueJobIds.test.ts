import {
  contentGenerateJobId,
  metricsFetchJobId,
  publishJobId,
  redditAdsSyncJobId,
  subredditComputeTimeWindowsJobId,
  subredditIngestJobId,
} from "@/lib/queue/jobIds";

describe("queue jobIds", () => {
  it("creates deterministic publish job id", () => {
    expect(publishJobId("sp_123")).toBe("publish__sp_123");
  });

  it("creates deterministic metrics fetch job id", () => {
    expect(metricsFetchJobId("pi_123")).toBe("metrics_fetch__pi_123");
  });

  it("creates deterministic content generate job id", () => {
    expect(contentGenerateJobId("dr_123")).toBe("content_generate__dr_123");
  });

  it("creates deterministic subreddit ingest job id", () => {
    expect(subredditIngestJobId("Startups")).toBe("subreddit_ingest__startups");
  });

  it("creates deterministic subreddit time windows job id", () => {
    expect(subredditComputeTimeWindowsJobId("sub_123")).toBe(
      "subreddit_compute_time_windows__sub_123",
    );
  });

  it("creates deterministic reddit ads sync job id", () => {
    expect(
      redditAdsSyncJobId({
        campaignId: "cmp_123",
        status: "ACTIVE",
        version: "2026-02-21T10:10:10.000Z",
      }),
    ).toBe("reddit_ads_sync__cmp_123__ACTIVE__2026-02-21T10_10_10.000Z");
  });

  it("sanitizes reserved delimiters in segments", () => {
    expect(metricsFetchJobId("pi:123")).toBe("metrics_fetch__pi_123");
  });
});
