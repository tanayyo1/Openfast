jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { validateAnalyticsPipeline } from "@/lib/analytics/validation";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  $queryRaw: jest.Mock;
};

function sqlFromTaggedCall(call: unknown[]): string {
  const strings = call[0] as TemplateStringsArray;
  return strings.join(" ");
}

describe("validateAnalyticsPipeline", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(10) }]) // homepage unique count
      .mockResolvedValueOnce([{ count: BigInt(1) }]) // ordered full funnel
      .mockResolvedValueOnce([{ count: BigInt(0) }]) // malformed events
      .mockResolvedValueOnce([{ event_name: "homepage_view", count: BigInt(10) }]) // perf query
      .mockResolvedValueOnce([{ event_name: "homepage_view", count: BigInt(10) }]) // event distribution
      .mockResolvedValueOnce([{ count: BigInt(5) }]); // recent events
  });

  test("uses unique homepage identities and ordered full-funnel progression", async () => {
    const result = await validateAnalyticsPipeline("ws_1");
    expect(result.passed).toBe(true);

    const homepageSql = sqlFromTaggedCall(mockedPrisma.$queryRaw.mock.calls[0]);
    expect(homepageSql).toContain(
      "COUNT(DISTINCT COALESCE(user_id, anonymous_session_id))",
    );

    const fullFunnelSql = sqlFromTaggedCall(
      mockedPrisma.$queryRaw.mock.calls[1],
    );
    expect(fullFunnelSql).toContain("signup_started");
    expect(fullFunnelSql).toContain("signup_completed");
    expect(fullFunnelSql).toContain("homepage_ts <= signup_started_ts");
    expect(fullFunnelSql).toContain(
      "signup_started_ts <= signup_completed_ts",
    );
    expect(fullFunnelSql).toContain(
      "onboarding_completed_ts <= plan_activated_ts",
    );
  });
});
