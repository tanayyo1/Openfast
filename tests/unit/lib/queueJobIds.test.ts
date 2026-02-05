import { metricsFetchJobId, publishJobId } from "@/lib/queue/jobIds";

describe("queue jobIds", () => {
  it("creates deterministic publish job id", () => {
    expect(publishJobId("sp_123")).toBe("publish:sp_123");
  });

  it("creates deterministic metrics fetch job id", () => {
    expect(metricsFetchJobId("pi_123")).toBe("metrics_fetch:pi_123");
  });
});
