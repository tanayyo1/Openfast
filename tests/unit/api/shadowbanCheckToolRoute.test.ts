jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: jest.fn(),
}));

jest.mock("@/lib/rateLimit/publicTools", () => ({
  enforcePublicToolRateLimit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    visibilityCheck: {
      findMany: jest.fn(),
    },
  },
}));

import { POST as postShadowbanCheckTool } from "@/app/api/tools/shadowban-check/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireSession: jest.Mock;
};
const mockedRateLimit = jest.requireMock("@/lib/rateLimit/publicTools") as {
  enforcePublicToolRateLimit: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  visibilityCheck: { findMany: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("shadowban-check tool route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireSession.mockRejectedValue(new Error("UNAUTHORIZED"));
    mockedRateLimit.enforcePublicToolRateLimit.mockResolvedValue({
      allowed: true,
      limit: 20,
      remaining: 19,
      resetAfterSeconds: 60,
    });
    mockedPrisma.visibilityCheck.findMany.mockResolvedValue([]);
  });

  test("returns 400 when username format is invalid", async () => {
    const res = await postShadowbanCheckTool(
      new Request("http://test.local/api/tools/shadowban-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bad name" }),
      }),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string; error: string };
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.error).toBe("Invalid input");
  });

  test("returns suspicious when reddit profile is unreachable", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));

    try {
      const res = await postShadowbanCheckTool(
        new Request("http://test.local/api/tools/shadowban-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "u/test_user" }),
        }),
      );

      expect(res.status).toBe(200);
      const json = (await readJson(res)) as {
        username: string;
        result: string;
        checks: {
          redditProfileReachable: boolean;
          redditProfileStatus: number;
        };
        meta: { resetAfterSeconds: number };
      };
      expect(json.username).toBe("test_user");
      expect(json.result).toBe("SUSPICIOUS");
      expect(json.checks.redditProfileReachable).toBe(false);
      expect(json.checks.redditProfileStatus).toBe(404);
      expect(json.meta.resetAfterSeconds).toBe(60);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("returns suspicious when internal suspicious rate is above threshold", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    mockedPrisma.visibilityCheck.findMany.mockResolvedValue([
      { result: "SUSPICIOUS", checkedAt: new Date() },
      { result: "SUSPICIOUS", checkedAt: new Date() },
      { result: "OK", checkedAt: new Date() },
    ]);

    try {
      const res = await postShadowbanCheckTool(
        new Request("http://test.local/api/tools/shadowban-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "test_user" }),
        }),
      );

      expect(res.status).toBe(200);
      const json = (await readJson(res)) as {
        result: string;
        checks: { internalSampleSize: number; internalSuspiciousRate: number };
      };
      expect(json.result).toBe("SUSPICIOUS");
      expect(json.checks.internalSampleSize).toBe(3);
      expect(json.checks.internalSuspiciousRate).toBeCloseTo(0.667, 3);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
