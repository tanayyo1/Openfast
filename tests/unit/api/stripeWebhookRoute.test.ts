jest.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    workspace: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    workspaceEntitlement: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/billing/stripe", () => ({
  getStripe: jest.fn(),
}));

import { POST as webhook } from "@/app/api/webhooks/stripe/route";
import { getStripe } from "@/lib/billing/stripe";

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  subscription: {
    upsert: jest.Mock;
    updateMany: jest.Mock;
    findFirst: jest.Mock;
  };
  workspace: {
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  workspaceEntitlement: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
};
const mockedGetStripe = getStripe as jest.Mock;
let stripeMock: { webhooks: { constructEvent: jest.Mock } };

describe("stripe webhook route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro";
    process.env.STRIPE_PRICE_LIFETIME = "price_life";
    process.env.STRIPE_PRICE_ENTERPRISE = "price_enterprise";

    mockedPrisma.subscription.upsert.mockResolvedValue(undefined);
    mockedPrisma.subscription.updateMany.mockResolvedValue(undefined);
    mockedPrisma.subscription.findFirst.mockResolvedValue(null);
    mockedPrisma.workspace.findUnique.mockResolvedValue({ plan: "FREE" });
    mockedPrisma.workspace.update.mockResolvedValue(undefined);
    mockedPrisma.workspaceEntitlement.upsert.mockResolvedValue(undefined);
    mockedPrisma.$transaction.mockImplementation(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    );

    stripeMock = {
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
    mockedGetStripe.mockReturnValue(stripeMock);
  });

  test("returns 500 when webhook signature is missing", async () => {
    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(res.status).toBe(500);
  });

  test("handles checkout.session.completed and applies workspace plan", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {
            workspaceId: "ws_1",
            plan: "PRO",
            priceId: "price_pro",
          },
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    });

    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: '{"id":"evt_1"}',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockedPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1" },
        update: expect.objectContaining({
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          stripePriceId: "price_pro",
          status: "ACTIVE",
        }),
      }),
    );
    expect(mockedPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_1" },
        data: { plan: "PRO" },
      }),
    );
  });

  test("handles subscription deletion by reverting workspace to FREE", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "canceled",
          metadata: { workspaceId: "ws_1", plan: "PRO" },
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_086_400,
          cancel_at_period_end: true,
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    });

    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig_test" },
        body: '{"id":"evt_2"}',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockedPrisma.subscription.updateMany).toHaveBeenCalled();
    expect(mockedPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_1" },
        data: { plan: "FREE" },
      }),
    );
  });
});
