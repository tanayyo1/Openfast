jest.mock("@/lib/server/admin-guards", () => ({
  requireWorkspaceAdminSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { POST as resetWorkspace } from "@/app/api/workspaces/current/reset/route";

const mockedAdminGuards = jest.requireMock("@/lib/server/admin-guards") as {
  requireWorkspaceAdminSession: jest.Mock;
};

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  $transaction: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("workspace reset route", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    jest.clearAllMocks();
    env.NODE_ENV = "test";
    mockedAdminGuards.requireWorkspaceAdminSession.mockResolvedValue({
      user: { id: "user_1" },
      workspaceId: "ws_1",
      supabaseUser: {
        id: "90ac967e-a8ed-4cb5-b11e-315fce39ef47",
        email: "owner@test.local",
      },
    });
  });

  afterAll(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  test("returns 403 in production", async () => {
    env.NODE_ENV = "production";

    const res = await resetWorkspace();

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("LOCAL_RESET_DISABLED");
    expect(
      mockedAdminGuards.requireWorkspaceAdminSession,
    ).not.toHaveBeenCalled();
  });

  test("maps workspace-required auth errors to 400", async () => {
    mockedAdminGuards.requireWorkspaceAdminSession.mockRejectedValueOnce(
      new Error("WORKSPACE_REQUIRED"),
    );

    const res = await resetWorkspace();

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("WORKSPACE_REQUIRED");
  });

  test("maps forbidden auth errors to 403", async () => {
    mockedAdminGuards.requireWorkspaceAdminSession.mockRejectedValueOnce(
      new Error("FORBIDDEN"),
    );

    const res = await resetWorkspace();

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("FORBIDDEN");
  });

  test("maps generic auth errors to 401", async () => {
    mockedAdminGuards.requireWorkspaceAdminSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await resetWorkspace();

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("rejects local-mode fallback sessions", async () => {
    mockedAdminGuards.requireWorkspaceAdminSession.mockResolvedValueOnce({
      user: { id: "user_1" },
      workspaceId: "ws_1",
      supabaseUser: {
        id: "local-user_1",
        email: "owner@test.local",
      },
    });

    const res = await resetWorkspace();

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("LOCAL_MODE_SESSION_FORBIDDEN");
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  test("resets workspace-scoped entities and returns counts", async () => {
    const tx = {
      project: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      redditAccount: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      analyticsEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 17 }),
      },
    };

    mockedPrisma.$transaction.mockImplementationOnce(
      async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx),
    );

    const res = await resetWorkspace();

    expect(res.status).toBe(200);
    expect(tx.project.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1" },
    });
    expect(tx.redditAccount.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1" },
    });
    expect(tx.analyticsEvent.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1" },
    });

    const json = (await readJson(res)) as {
      workspaceId: string;
      reset: {
        projects: number;
        redditAccounts: number;
        analyticsEvents: number;
      };
    };
    expect(json.workspaceId).toBe("ws_1");
    expect(json.reset).toEqual({
      projects: 2,
      redditAccounts: 1,
      analyticsEvents: 17,
    });
  });
});
