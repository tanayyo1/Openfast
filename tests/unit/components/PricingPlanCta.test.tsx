/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  PRICING_SIGNUP_REDIRECT,
  PricingPlanCta,
} from "@/components/public/PricingPlanCta";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function jsonResponse(status: number, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("PricingPlanCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders signup link for free plan", () => {
    render(
      <PricingPlanCta plan="FREE" cta="Get started" className="pricing-cta" />,
    );

    const link = screen.getByRole("link", { name: "Get started" });
    expect(link).toHaveAttribute("href", "/signup");
  });

  test("starts checkout and navigates to provider URL", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        checkoutUrl: "https://billing.example/checkout/123",
      }),
    );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    const onNavigate = jest.fn();

    render(
      <PricingPlanCta
        plan="PRO"
        cta="Upgrade to Pro"
        className="pricing-cta"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/checkout",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(
        "https://billing.example/checkout/123",
      );
    });
  });

  test("redirects unauthenticated users to signup flow", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { error: "Unauthorized", code: "UNAUTHORIZED" }),
      );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    const onNavigate = jest.fn();

    render(
      <PricingPlanCta
        plan="PRO"
        cta="Upgrade to Pro"
        className="pricing-cta"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(PRICING_SIGNUP_REDIRECT);
    });
  });

  test("surfaces billing configuration errors", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      jsonResponse(500, {
        error: "Plan is not configured for checkout",
        code: "PRICE_NOT_CONFIGURED",
      }),
    );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(
      <PricingPlanCta
        plan="PRO"
        cta="Upgrade to Pro"
        className="pricing-cta"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Pro checkout is not configured yet. Please contact support.",
        ),
      ).toBeInTheDocument();
    });
  });

  test("blocks duplicate clicks while checkout request is in flight", async () => {
    let resolveFetch!: (value: MockResponse) => void;
    const fetchPromise = new Promise<MockResponse>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = jest.fn().mockImplementation(() => fetchPromise);
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    const onNavigate = jest.fn();

    render(
      <PricingPlanCta
        plan="PRO"
        cta="Upgrade to Pro"
        className="pricing-cta"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    fireEvent.click(screen.getByRole("button", { name: "Redirecting..." }));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      jsonResponse(200, {
        checkoutUrl: "https://billing.example/checkout/456",
      }),
    );

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(
        "https://billing.example/checkout/456",
      );
    });
  });
});
