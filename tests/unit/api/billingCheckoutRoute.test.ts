jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/billing/polar", () => ({
  getPolar: jest.fn(),
}));

import { POST as checkout } from "@/app/api/billing/checkout/route";
import { getPolar } from "@/lib/billing/polar";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  workspace: { findUnique: jest.Mock };
};
const mockedGetPolar = getPolar as jest.Mock;

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("billing checkout route", () => {
  let polarMock: {
    checkouts: { create: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.POLAR_PRODUCT_PRO = "product_pro_uuid";
    process.env.APP_URL = "https://app.example.com";
    process.env.BILLING_ALLOWED_REDIRECT_ORIGINS = "https://app.example.com";

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_1",
      name: "Workspace 1",
      owner: { email: "owner@test.com" },
    });

    polarMock = {
      checkouts: {
        create: jest.fn().mockResolvedValue({
          id: "polar_ch_1",
          url: "https://checkout.polar.sh/polar_ch_1",
          status: "open",
        }),
      },
    };
    mockedGetPolar.mockReturnValue(polarMock);
  });

  test("creates a checkout session for PRO plan", async () => {
    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "PRO",
          successUrl: "https://app.example.com/dashboard?billing=ok",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      checkoutId: string;
      checkoutSessionId: string;
      checkoutUrl: string;
    };
    expect(json.checkoutId).toBe("polar_ch_1");
    expect(json.checkoutSessionId).toBe("polar_ch_1");
    expect(json.checkoutUrl).toContain("checkout.polar.sh");

    expect(polarMock.checkouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        products: ["product_pro_uuid"],
        customerEmail: "owner@test.com",
        metadata: expect.objectContaining({
          workspaceId: "ws_1",
          userId: "u_1",
          plan: "PRO",
        }),
      }),
    );
  });

  test("returns both checkoutId and checkoutSessionId for backward compat", async () => {
    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      checkoutId: string;
      checkoutSessionId: string;
    };
    expect(json.checkoutId).toBe(json.checkoutSessionId);
  });

  test("returns 500 when POLAR_PRODUCT_PRO is not configured", async () => {
    delete process.env.POLAR_PRODUCT_PRO;

    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      }),
    );

    expect(res.status).toBe(500);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PRICE_NOT_CONFIGURED");
  });

  test("rejects redirect url outside allowed origins", async () => {
    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "PRO",
          successUrl: "https://evil.example.com/pwn",
        }),
      }),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("INVALID_REDIRECT_URL");
  });

  test("returns BILLING_PROVIDER_ERROR when Polar API fails", async () => {
    polarMock.checkouts.create.mockRejectedValue(new Error("Polar API down"));

    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      }),
    );

    expect(res.status).toBe(500);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("BILLING_PROVIDER_ERROR");
  });

  test("returns unauthorized when session is missing", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      }),
    );

    expect(res.status).toBe(401);
  });
});
