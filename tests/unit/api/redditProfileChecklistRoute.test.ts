jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    redditAccount: { findFirst: jest.fn() },
    accountHealthSnapshot: { findFirst: jest.fn() },
    publishedItem: { count: jest.fn() },
  },
}));

import { GET as getProfileChecklist } from "@/app/api/reddit/accounts/[id]/profile-checklist/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  redditAccount: { findFirst: jest.Mock };
  accountHealthSnapshot: { findFirst: jest.Mock };
  publishedItem: { count: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("reddit profile checklist route (RED-54)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedPrisma.accountHealthSnapshot.findFirst.mockResolvedValue({
      healthScore: 72,
      capturedAt: new Date("2026-02-17T00:00:00.000Z"),
    });
    mockedPrisma.publishedItem.count.mockResolvedValue(4);
  });

  test("returns 404 when account is missing", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue(null);

    const res = await getProfileChecklist(
      new Request(
        "http://test.local/api/reddit/accounts/missing/profile-checklist",
      ),
      { params: { id: "missing" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("REDDIT_ACCOUNT_NOT_FOUND");
  });

  test("returns checklist summary and items", async () => {
    mockedPrisma.redditAccount.findFirst.mockResolvedValue({
      id: "ra_1",
      redditUsername: "founder_handle",
      scopes: ["identity", "read", "submit"],
      accountAge: 45,
      linkKarma: 60,
      commentKarma: 40,
      safetyTier: "ESTABLISHED",
      lastSyncAt: new Date(),
      isActive: true,
    });

    const res = await getProfileChecklist(
      new Request(
        "http://test.local/api/reddit/accounts/ra_1/profile-checklist",
      ),
      { params: { id: "ra_1" } },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      account: { redditUsername: string };
      checklist: {
        score: number;
        summary: { total: number; passed: number };
        readiness: string;
        items: Array<{ key: string; status: string }>;
      };
    };

    expect(json.account.redditUsername).toBe("founder_handle");
    expect(typeof json.checklist.score).toBe("number");
    expect(json.checklist.summary.total).toBeGreaterThan(0);
    expect(
      json.checklist.items.some((item) => item.key === "required_scopes"),
    ).toBe(true);
    expect(["READY", "NEEDS_IMPROVEMENT", "NOT_READY"]).toContain(
      json.checklist.readiness,
    );
  });
});
