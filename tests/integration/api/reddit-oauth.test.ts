import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { GET as oauthStart } from "@/app/api/reddit/oauth/start/route";
import { GET as oauthCallback } from "@/app/api/reddit/oauth/callback/route";
import { GET as listAccounts } from "@/app/api/reddit/accounts/route";
import { DELETE as disconnectAccount } from "@/app/api/reddit/accounts/[id]/route";
import { POST as devConnect } from "@/app/api/reddit/accounts/dev-connect/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

describe("Reddit OAuth APIs (workspace-scoped)", () => {
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    process.env.REDDIT_CLIENT_ID = "client";
    process.env.REDDIT_CLIENT_SECRET = "secret";
    process.env.REDDIT_REDIRECT_URI =
      "http://localhost:3000/api/reddit/oauth/callback";
    process.env.REDDIT_USER_AGENT = "ReditFastTest/0.1";

    const key = Buffer.alloc(32, 1).toString("base64");
    process.env.TOKEN_ENCRYPTION_KEYS = `v1:${key}`;

    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) throw new Error("Seed user missing. Ensure prisma db seed ran.");

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws)
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");

    userId = user.id;
    workspaceId = ws.workspaceId;
    await prisma.workspaceEntitlement.upsert({
      where: { workspaceId },
      update: { maxRedditAccounts: 10 },
      create: {
        workspaceId,
        maxProjects: 5,
        maxRedditAccounts: 10,
        maxScheduledPosts: 200,
        maxDraftsPerMonth: 2000,
        roadmapDays: 30,
        hasAdvancedAnalytics: true,
        hasSmartFinder: true,
        hasTeamFeatures: false,
      },
    });

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("oauth start sets state cookie and redirects to reddit", async () => {
    const res = await oauthStart(
      new Request(
        "http://test.local/api/reddit/oauth/start?next=/onboarding/connect-reddit",
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain(
      "https://www.reddit.com/api/v1/authorize",
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("rf_reddit_oauth_state=");
  });

  test("oauth callback upserts account, lists, then disconnects", async () => {
    const fetchMock: typeof fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/access_token")) {
        return new Response(
          JSON.stringify({
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
            scope: "identity read submit",
            token_type: "bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/api/v1/me")) {
        return new Response(
          JSON.stringify({
            name: "test_user",
            id: "t2_abc",
            link_karma: 10,
            comment_karma: 5,
            created_utc: Math.floor(Date.now() / 1000) - 86400,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    };

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const state = "state123";
    const callbackReq = new Request(
      `http://test.local/api/reddit/oauth/callback?code=code123&state=${state}`,
      {
        headers: {
          cookie: `rf_reddit_oauth_state=${state}; rf_reddit_oauth_next=/onboarding/connect-reddit`,
        },
      },
    );

    const res = await oauthCallback(callbackReq);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);

    const listRes = await listAccounts();
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      items: Array<{ id: string; redditUsername: string }>;
    };
    const account = listJson.items.find(
      (a) => a.redditUsername === "test_user",
    );
    expect(account).toBeTruthy();

    if (!account) return;

    const delRes = await disconnectAccount(
      new Request(`http://test.local/api/reddit/accounts/${account.id}`, {
        method: "DELETE",
      }),
      {
        params: { id: account.id },
      },
    );
    expect(delRes.status).toBe(200);

    const remaining = await prisma.redditAccount.findFirst({
      where: { id: account.id },
      select: { id: true },
    });
    expect(remaining).toBeNull();
  });

  test("dev connect creates workspace-scoped mock account", async () => {
    const username = `dev_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const res = await devConnect(
      new Request("http://test.local/api/reddit/accounts/dev-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, tier: "ESTABLISHED" }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      account: { id: string; redditUsername: string; safetyTier: string };
    };
    expect(json.account.redditUsername).toBe(username);
    expect(json.account.safetyTier).toBe("ESTABLISHED");

    const stored = await prisma.redditAccount.findUnique({
      where: { id: json.account.id },
      select: {
        accessToken: true,
        refreshToken: true,
        workspaceId: true,
      },
    });
    expect(stored?.workspaceId).toBe(workspaceId);
    expect(stored?.accessToken.startsWith("rfenc.")).toBe(true);
    expect(stored?.refreshToken.startsWith("rfenc.")).toBe(true);

    await prisma.redditAccount.delete({ where: { id: json.account.id } });
  });
});
