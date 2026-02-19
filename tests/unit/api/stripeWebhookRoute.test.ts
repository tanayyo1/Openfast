import { POST as webhook } from "@/app/api/webhooks/stripe/route";

describe("stripe webhook route (deprecated)", () => {
  test("returns 200 with deprecated flag", async () => {
    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"type":"checkout.session.completed"}',
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; deprecated: boolean };
    expect(json.ok).toBe(true);
    expect(json.deprecated).toBe(true);
  });

  test("returns 200 even with invalid JSON body", async () => {
    const res = await webhook(
      new Request("http://test.local/api/webhooks/stripe", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { deprecated: boolean };
    expect(json.deprecated).toBe(true);
  });
});
