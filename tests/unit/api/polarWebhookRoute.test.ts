jest.mock("@polar-sh/sdk/webhooks", () => ({
  validateEvent: jest.fn(),
  WebhookVerificationError: class WebhookVerificationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WebhookVerificationError";
    }
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    workspace: {
      update: jest.fn(),
    },
    workspaceEntitlement: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/billing/polar-products", () => ({
  planFromPolarProductId: jest.fn(),
}));

import { POST as webhook } from "@/app/api/webhooks/polar/route";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { planFromPolarProductId } from "@/lib/billing/polar-products";

const mockedValidateEvent = validateEvent as jest.Mock;
const mockedPlanFromProduct = planFromPolarProductId as jest.Mock;
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  subscription: {
    upsert: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
  };
  workspace: {
    update: jest.Mock;
  };
  workspaceEntitlement: {
    upsert: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makeRequest(body: string = "{}") {
  return new Request("http://test.local/api/webhooks/polar", {
    method: "POST",
    headers: {
      "webhook-id": "wh_123",
      "webhook-timestamp": "1700000000",
      "webhook-signature": "v1,sig_test",
    },
    body,
  });
}

describe("polar webhook route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.POLAR_WEBHOOK_SECRET = "test_secret";
    process.env.POLAR_PRODUCT_PRO = "product_pro_uuid";
    process.env.POLAR_PRODUCT_ENTERPRISE = "product_enterprise_uuid";

    mockedPrisma.subscription.upsert.mockResolvedValue(undefined);
    mockedPrisma.subscription.updateMany.mockResolvedValue(undefined);
    mockedPrisma.subscription.findMany.mockResolvedValue([]);
    mockedPrisma.workspace.update.mockResolvedValue(undefined);
    mockedPrisma.workspaceEntitlement.upsert.mockResolvedValue(undefined);
    mockedPrisma.$transaction.mockImplementation(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    );
    mockedPlanFromProduct.mockReturnValue(null);
  });

  test("returns 500 when POLAR_WEBHOOK_SECRET is missing", async () => {
    delete process.env.POLAR_WEBHOOK_SECRET;

    const res = await webhook(makeRequest());
    expect(res.status).toBe(500);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("POLAR_WEBHOOK_NOT_CONFIGURED");
  });

  test("returns 400 when signature verification fails", async () => {
    mockedValidateEvent.mockImplementation(() => {
      throw new WebhookVerificationError("bad sig");
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(400);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe("BAD_SIGNATURE");
  });

  test("handles checkout.updated (status=succeeded) — upserts subscription, applies plan", async () => {
    mockedPlanFromProduct.mockReturnValue("PRO");
    mockedValidateEvent.mockReturnValue({
      type: "checkout.updated",
      data: {
        status: "succeeded",
        customerId: "polar_cus_1",
        subscriptionId: "polar_sub_1",
        productId: "product_pro_uuid",
        metadata: { workspaceId: "ws_1", plan: "PRO" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1" },
        update: expect.objectContaining({
          provider: "polar",
          providerCustomerId: "polar_cus_1",
          providerSubscriptionId: "polar_sub_1",
          status: "ACTIVE",
          stripeCustomerId: null,
        }),
        create: expect.objectContaining({
          workspaceId: "ws_1",
          provider: "polar",
          providerCustomerId: "polar_cus_1",
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

  test("handles subscription.updated with active status — upserts subscription, applies plan", async () => {
    mockedPlanFromProduct.mockReturnValue("PRO");
    mockedValidateEvent.mockReturnValue({
      type: "subscription.updated",
      data: {
        id: "polar_sub_1",
        status: "active",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        currentPeriodStart: "2026-02-01T00:00:00Z",
        currentPeriodEnd: "2026-03-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1" },
        update: expect.objectContaining({
          provider: "polar",
          providerSubscriptionId: "polar_sub_1",
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
        }),
        create: expect.objectContaining({
          workspaceId: "ws_1",
          provider: "polar",
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

  test("handles subscription.canceled — reverts workspace to FREE", async () => {
    mockedValidateEvent.mockReturnValue({
      type: "subscription.canceled",
      data: {
        id: "polar_sub_1",
        status: "canceled",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelAtPeriodEnd: true,
        }),
      }),
    );

    expect(mockedPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_1" },
        data: { plan: "FREE" },
      }),
    );
  });

  test("handles subscription.revoked — reverts workspace to FREE", async () => {
    mockedValidateEvent.mockReturnValue({
      type: "subscription.revoked",
      data: {
        id: "polar_sub_1",
        status: "canceled",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
        }),
      }),
    );

    expect(mockedPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_1" },
        data: { plan: "FREE" },
      }),
    );
  });

  test("skips events when workspaceId metadata is missing", async () => {
    mockedValidateEvent.mockReturnValue({
      type: "checkout.updated",
      data: {
        status: "succeeded",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        metadata: {},
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { skipped: string };
    expect(json.skipped).toBe("no_workspace_id");

    expect(mockedPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  test("skips checkout.updated when status is not succeeded", async () => {
    mockedValidateEvent.mockReturnValue({
      type: "checkout.updated",
      data: {
        status: "open",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);
    expect(mockedPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  test("does not upgrade plan when product ID is unrecognized and metadata has no plan", async () => {
    mockedPlanFromProduct.mockReturnValue(null);
    mockedValidateEvent.mockReturnValue({
      type: "checkout.updated",
      data: {
        status: "succeeded",
        customerId: "polar_cus_1",
        subscriptionId: "polar_sub_1",
        productId: "unknown_product",
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.upsert).toHaveBeenCalled();
    expect(mockedPrisma.workspace.update).not.toHaveBeenCalled();
  });

  test("reverts to FREE when subscription.updated has incomplete_expired status", async () => {
    mockedPlanFromProduct.mockReturnValue("PRO");
    mockedValidateEvent.mockReturnValue({
      type: "subscription.updated",
      data: {
        id: "polar_sub_1",
        status: "incomplete_expired",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        currentPeriodStart: "2026-02-01T00:00:00Z",
        currentPeriodEnd: "2026-03-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ws_1" },
        data: { plan: "FREE" },
      }),
    );
  });

  test("resolves workspaceId from subscription lookup when metadata is missing", async () => {
    mockedPlanFromProduct.mockReturnValue("PRO");
    mockedPrisma.subscription.findMany.mockResolvedValue([
      { workspaceId: "ws_from_db" },
    ]);
    mockedValidateEvent.mockReturnValue({
      type: "subscription.updated",
      data: {
        id: "polar_sub_1",
        status: "active",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        currentPeriodStart: "2026-02-01T00:00:00Z",
        currentPeriodEnd: "2026-03-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        metadata: {},
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.findMany).toHaveBeenCalledWith({
      where: { provider: "polar", providerSubscriptionId: "polar_sub_1" },
      select: { workspaceId: true },
      take: 2,
    });
    expect(mockedPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws_from_db" },
      }),
    );
  });

  test("skips subscription update when provider subscription lookup is ambiguous", async () => {
    mockedPrisma.subscription.findMany.mockResolvedValue([
      { workspaceId: "ws_1" },
      { workspaceId: "ws_2" },
    ]);
    mockedValidateEvent.mockReturnValue({
      type: "subscription.updated",
      data: {
        id: "polar_sub_dup",
        status: "active",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        currentPeriodStart: "2026-02-01T00:00:00Z",
        currentPeriodEnd: "2026-03-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        metadata: {},
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { skipped: string };
    expect(json.skipped).toBe("ambiguous_provider_subscription");
    expect(mockedPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  test("handles mixed-case status values from Polar", async () => {
    mockedPlanFromProduct.mockReturnValue("PRO");
    mockedValidateEvent.mockReturnValue({
      type: "subscription.updated",
      data: {
        id: "polar_sub_1",
        status: "Active",
        customerId: "polar_cus_1",
        productId: "product_pro_uuid",
        currentPeriodStart: "2026-02-01T00:00:00Z",
        currentPeriodEnd: "2026-03-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        metadata: { workspaceId: "ws_1" },
      },
    });

    const res = await webhook(makeRequest());
    expect(res.status).toBe(200);

    expect(mockedPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "ACTIVE",
        }),
      }),
    );
  });
});
