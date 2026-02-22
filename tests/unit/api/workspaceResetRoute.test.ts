jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { POST as resetWorkspace } from "@/app/api/workspaces/current/reset/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
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
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "user_1" },
      workspaceId: "ws_1",
    });
  });

  afterAll(() => {
    env.NODE_ENV = originalNodeEnv;
  });

  test("returns 403 in production", async () => {
    env.NODE_ENV = "production";
    const res = await resetWorkspace(
      new Request("http://test.local/api/workspaces/current/reset", {
        method: "POST",
        headers: { cookie: "rf_demo_auth=1" },
      }),
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("LOCAL_RESET_DISABLED");
    expect(mockedGuards.requireWorkspaceSession).not.toHaveBeenCalled();
  });

  test("returns 403 when local mode cookie is missing", async () => {
    const res = await resetWorkspace(
      new Request("http://test.local/api/workspaces/current/reset", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(403);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("LOCAL_MODE_REQUIRED");
    expect(mockedGuards.requireWorkspaceSession).not.toHaveBeenCalled();
  });

  test("maps workspace-required auth errors to 400", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("WORKSPACE_REQUIRED"),
    );

    const res = await resetWorkspace(
      new Request("http://test.local/api/workspaces/current/reset", {
        method: "POST",
        headers: { cookie: "rf_demo_auth=1" },
      }),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("WORKSPACE_REQUIRED");
  });

  test("maps generic auth errors to 401", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await resetWorkspace(
      new Request("http://test.local/api/workspaces/current/reset", {
        method: "POST",
        headers: { cookie: "rf_demo_auth=1" },
      }),
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
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

    const res = await resetWorkspace(
      new Request("http://test.local/api/workspaces/current/reset", {
        method: "POST",
        headers: { cookie: "rf_demo_auth=1" },
      }),
    );

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
