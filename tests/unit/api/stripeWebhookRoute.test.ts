import { POST as webhook } from "@/app/api/webhooks/stripe/route";

describe("stripe webhook route (deprecated)", () => {
  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_LEGACY_ACK;
  });

  test("returns 410 by default with deprecated code", async () => {
    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"type":"checkout.session.completed"}',
      }),
    );

    expect(res.status).toBe(410);
    const json = (await res.json()) as { code: string; deprecated: boolean };
    expect(json.code).toBe("STRIPE_WEBHOOK_DEPRECATED");
    expect(json.deprecated).toBe(true);
  });

  test("returns 410 even with invalid JSON body", async () => {
    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(res.status).toBe(410);
    const json = (await res.json()) as { deprecated: boolean };
    expect(json.deprecated).toBe(true);
  });

  test("allows temporary 200 legacy ack when STRIPE_WEBHOOK_LEGACY_ACK=1", async () => {
    process.env.STRIPE_WEBHOOK_LEGACY_ACK = "1";
    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"type":"invoice.paid"}',
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      deprecated: boolean;
      accepted: boolean;
    };
    expect(json.ok).toBe(true);
    expect(json.deprecated).toBe(true);
    expect(json.accepted).toBe(false);
  });
});
