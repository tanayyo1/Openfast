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

jest.mock("@/lib/billing/stripe", () => ({
  getStripe: jest.fn(),
}));

import { POST as checkout } from "@/app/api/billing/checkout/route";
import { getStripe } from "@/lib/billing/stripe";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  workspace: { findUnique: jest.Mock };
};
const mockedGetStripe = getStripe as jest.Mock;

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("billing checkout route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro";
    process.env.STRIPE_PRICE_LIFETIME = "price_life";
    process.env.APP_URL = "https://app.example.com";
    process.env.BILLING_ALLOWED_REDIRECT_ORIGINS = "https://app.example.com";

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      workspaceId: "ws_1",
      user: { id: "u_1" },
    });
    mockedPrisma.workspace.findUnique.mockResolvedValue({
      id: "ws_1",
      name: "Workspace 1",
      subscription: null,
    });
    mockedGetStripe.mockReturnValue({
      customers: {
        create: jest.fn().mockResolvedValue({ id: "cus_1" }),
      },
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: "cs_1",
            url: "https://checkout.stripe.test/session/cs_1",
          }),
        },
      },
    });
  });

  test("creates a checkout session for PRO plan", async () => {
    const res = await checkout(
      new Request("http://test.local/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "PRO",
          successUrl: "https://app.example.com/dashboard?billing=ok",
          cancelUrl: "https://app.example.com/pricing?billing=cancel",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      checkoutSessionId: string;
      checkoutUrl: string;
    };
    expect(json.checkoutSessionId).toBe("cs_1");
    expect(json.checkoutUrl).toContain("checkout.stripe.test");

    const stripe = mockedGetStripe.mock.results[0]?.value as {
      checkout: { sessions: { create: jest.Mock } };
    };
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
        metadata: expect.objectContaining({
          workspaceId: "ws_1",
          userId: "u_1",
          plan: "PRO",
        }),
      }),
    );
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
