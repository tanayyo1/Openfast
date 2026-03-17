jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: jest.fn(),
}));

jest.mock("@/lib/rateLimit/publicTools", () => ({
  enforcePublicToolRateLimit: jest.fn(),
}));

jest.mock("@/lib/reddit/proxyFetch", () => ({
  fetchRedditJson: jest.fn(),
}));

import { POST as postShadowbanCheckTool } from "@/app/api/tools/shadowban-check/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireSession: jest.Mock;
};
const mockedRateLimit = jest.requireMock("@/lib/rateLimit/publicTools") as {
  enforcePublicToolRateLimit: jest.Mock;
};
const mockedProxy = jest.requireMock("@/lib/reddit/proxyFetch") as {
  fetchRedditJson: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function mockRedditResponse(
  profileStatus: number,
  profileData?: Record<string, unknown>,
  activityChildren?: unknown[],
) {
  mockedProxy.fetchRedditJson.mockImplementation((path: string) => {
    if (path.includes("/about.json")) {
      return Promise.resolve(
        new Response(JSON.stringify(profileData ? { data: profileData } : {}), {
          status: profileStatus,
        }),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({ data: { children: activityChildren ?? [] } }),
        { status: 200 },
      ),
    );
  });
}

function makeRequest(body: unknown) {
  return new Request("http://test.local/api/tools/shadowban-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  });

  test("returns 429 when rate limited", async () => {
    mockedRateLimit.enforcePublicToolRateLimit.mockResolvedValue({
      allowed: false,
      limit: 20,
      remaining: 0,
      resetAfterSeconds: 60,
    });

    const res = await postShadowbanCheckTool(makeRequest({ username: "test" }));
    expect(res.status).toBe(429);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("RATE_LIMITED");
  });

  test("returns 400 for malformed JSON body", async () => {
    const res = await postShadowbanCheckTool(
      new Request("http://test.local/api/tools/shadowban-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("BAD_JSON");
  });

  test("returns 400 when username format is invalid", async () => {
    const res = await postShadowbanCheckTool(
      makeRequest({ username: "bad name" }),
    );
    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  test("strips u/ prefix from username", async () => {
    mockRedditResponse(200, { name: "test_user", total_karma: 10 }, [
      { kind: "t1" },
    ]);

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "u/test_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { username: string };
    expect(json.username).toBe("test_user");
  });

  test("returns NOT_FOUND when profile returns 404", async () => {
    mockRedditResponse(404);

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "nonexistent_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { result: string; profile: null };
    expect(json.result).toBe("NOT_FOUND");
    expect(json.profile).toBeNull();
  });

  test("returns SHADOWBANNED when profile returns 403", async () => {
    mockRedditResponse(403);

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "blocked_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { result: string };
    expect(json.result).toBe("SHADOWBANNED");
  });

  test("returns CLEAR for healthy account with activity", async () => {
    mockRedditResponse(
      200,
      {
        name: "test_user",
        total_karma: 500,
        comment_karma: 200,
        has_verified_email: true,
        created_utc: 1600000000,
      },
      [
        { kind: "t1", data: {} },
        { kind: "t3", data: {} },
      ],
    );

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "test_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      result: string;
      profile: { karma: number; recentActivityCount: number };
    };
    expect(json.result).toBe("CLEAR");
    expect(json.profile.karma).toBe(500);
    expect(json.profile.recentActivityCount).toBe(2);
  });

  test("returns SHADOWBANNED when profile exists but no activity", async () => {
    mockRedditResponse(200, { name: "shadow_user", total_karma: 1 }, []);

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "shadow_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { result: string };
    expect(json.result).toBe("SHADOWBANNED");
  });

  test("returns AT_RISK when karma is negative", async () => {
    mockRedditResponse(
      200,
      { name: "neg_user", total_karma: -10, comment_karma: -15 },
      [{ kind: "t1", data: {} }],
    );

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "neg_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      result: string;
      profile: { karma: number };
    };
    expect(json.result).toBe("AT_RISK");
    expect(json.profile.karma).toBe(-10);
  });

  test("returns SUSPENDED for suspended account", async () => {
    mockRedditResponse(
      200,
      { name: "banned_user", is_suspended: true, total_karma: 0 },
      [],
    );

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "banned_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as { result: string };
    expect(json.result).toBe("SUSPENDED");
  });

  test("returns UNREACHABLE on timeout", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    mockedProxy.fetchRedditJson.mockRejectedValue(abortError);

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "test_user" }),
    );
    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      result: string;
      checks: { redditProfileTimedOut: boolean };
    };
    expect(json.result).toBe("UNREACHABLE");
    expect(json.checks.redditProfileTimedOut).toBe(true);
  });

  test("does not expose internal signals to public", async () => {
    mockRedditResponse(200, { name: "test_user", total_karma: 100 }, [
      { kind: "t1" },
    ]);

    const res = await postShadowbanCheckTool(
      makeRequest({ username: "test_user" }),
    );
    const json = (await readJson(res)) as Record<string, unknown>;
    const checks = json.checks as Record<string, unknown>;
    expect(checks).not.toHaveProperty("internalSampleSize");
    expect(checks).not.toHaveProperty("internalSuspiciousRate");
  });
});
