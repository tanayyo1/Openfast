jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { POST as ingestEvents } from "@/app/api/analytics/events/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  $transaction: jest.Mock;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

describe("analytics events ingest route (RED-79A)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("accepts public homepage event without session", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    const executeRaw = jest.fn().mockResolvedValue(1);
    mockedPrisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        $executeRaw: executeRaw,
      }),
    );

    const res = await ingestEvents(
      new Request("http://test.local/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              eventName: "homepage_view",
              source: "web_public",
              anonymousSessionId: "anon_1",
              page: "/",
              properties: { placement: "hero" },
            },
          ],
        }),
      }),
    );

    expect(res.status).toBe(202);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  test("rejects protected onboarding event without workspace context", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    const res = await ingestEvents(
      new Request("http://test.local/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              eventName: "onboarding_completed",
              source: "web_app",
            },
          ],
        }),
      }),
    );

    const body = await readJson<{ violations: Array<{ reason: string }> }>(res);
    expect(res.status).toBe(400);
    expect(body.violations[0]?.reason).toMatch(/workspaceId is required/i);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects workspace mismatch for authenticated session", async () => {
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "user_1" },
    });

    const res = await ingestEvents(
      new Request("http://test.local/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [
            {
              eventName: "plan_activated",
              workspaceId: "ws_other",
              source: "web_app",
            },
          ],
        }),
      }),
    );

    const body = await readJson<{ violations: Array<{ reason: string }> }>(res);
    expect(res.status).toBe(400);
    expect(body.violations[0]?.reason).toMatch(
      /does not match authenticated workspace/i,
    );
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
