jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/reddit/oauth", () => ({
  getRedditOAuthConfig: jest.fn(),
}));

import { GET as oauthStatus } from "@/app/api/reddit/oauth/status/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

const mockedOauth = jest.requireMock("@/lib/reddit/oauth") as {
  getRedditOAuthConfig: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("reddit oauth status route", () => {
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

  test("returns 401 for unauthorized session", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("UNAUTHORIZED"),
    );

    const res = await oauthStatus(
      new Request("http://test.local/api/reddit/oauth/status"),
    );

    expect(res.status).toBe(401);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("UNAUTHORIZED");
  });

  test("returns 400 for missing workspace membership", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("WORKSPACE_REQUIRED"),
    );

    const res = await oauthStatus(
      new Request("http://test.local/api/reddit/oauth/status"),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("WORKSPACE_REQUIRED");
  });

  test("returns 503 when supabase env is not configured", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValueOnce(
      new Error("SUPABASE_NOT_CONFIGURED"),
    );

    const res = await oauthStatus(
      new Request("http://test.local/api/reddit/oauth/status"),
    );

    expect(res.status).toBe(503);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("SUPABASE_NOT_CONFIGURED");
  });

  test("returns configured flags when oauth is available", async () => {
    mockedOauth.getRedditOAuthConfig.mockReturnValueOnce({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/api/reddit/oauth/callback",
      userAgent: "ReditFastTest/0.1",
    });

    const res = await oauthStatus(
      new Request("http://test.local/api/reddit/oauth/status"),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      oauthConfigured: boolean;
      localModeSession: boolean;
      devConnectAvailable: boolean;
    };
    expect(json.oauthConfigured).toBe(true);
    expect(json.localModeSession).toBe(false);
    expect(json.devConnectAvailable).toBe(true);
  });

  test("detects local-mode cookie when oauth is not configured", async () => {
    mockedOauth.getRedditOAuthConfig.mockReturnValueOnce(null);

    const res = await oauthStatus(
      new Request("http://test.local/api/reddit/oauth/status", {
        headers: {
          cookie: "rf_demo_auth=1",
        },
      }),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      oauthConfigured: boolean;
      localModeSession: boolean;
      devConnectAvailable: boolean;
    };
    expect(json.oauthConfigured).toBe(false);
    expect(json.localModeSession).toBe(true);
    expect(json.devConnectAvailable).toBe(true);
  });

  test("returns devConnectAvailable false in production", async () => {
    env.NODE_ENV = "production";
    mockedOauth.getRedditOAuthConfig.mockReturnValueOnce({
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/api/reddit/oauth/callback",
      userAgent: "ReditFastTest/0.1",
    });

    const res = await oauthStatus(
      new Request("http://test.local/api/reddit/oauth/status"),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      oauthConfigured: boolean;
      localModeSession: boolean;
      devConnectAvailable: boolean;
    };
    expect(json.oauthConfigured).toBe(true);
    expect(json.localModeSession).toBe(false);
    expect(json.devConnectAvailable).toBe(false);
  });
});
