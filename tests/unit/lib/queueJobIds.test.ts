import {
  contentGenerateJobId,
  metricsFetchJobId,
  publishJobId,
  subredditComputeTimeWindowsJobId,
  subredditIngestJobId,
} from "@/lib/queue/jobIds";

describe("queue jobIds", () => {
  it("creates deterministic publish job id", () => {
    expect(publishJobId("sp_123")).toBe("publish:sp_123");
  });

  it("creates deterministic metrics fetch job id", () => {
    expect(metricsFetchJobId("pi_123")).toBe("metrics_fetch:pi_123");
  });

  it("creates deterministic content generate job id", () => {
    expect(contentGenerateJobId("dr_123")).toBe("content_generate:dr_123");
  });

  it("creates deterministic subreddit ingest job id", () => {
    expect(subredditIngestJobId("Startups")).toBe("subreddit_ingest:startups");
  });

  it("creates deterministic subreddit time windows job id", () => {
    expect(subredditComputeTimeWindowsJobId("sub_123")).toBe(
      "subreddit_compute_time_windows:sub_123",
    );
  });
});
