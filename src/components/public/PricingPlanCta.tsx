"use client";

import Link from "next/link";
import { useState } from "react";

type PricingPlanCtaProps = {
  plan: "FREE" | "PRO";
  cta: string;
  className: string;
  onNavigate?: (url: string) => void;
};

type CheckoutResponse = {
  checkoutUrl?: string;
  error?: string;
  code?: string;
};

export const PRICING_SIGNUP_REDIRECT = "/signup?next=%2Fpricing";

const CHECKOUT_ERROR_COPY: Record<string, string> = {
  PRICE_NOT_CONFIGURED:
    "Pro checkout is not configured yet. Please contact support.",
  REDIRECT_ORIGINS_NOT_CONFIGURED:
    "Billing redirects are not configured yet. Please contact support.",
  BILLING_PROVIDER_ERROR:
    "Billing provider is temporarily unavailable. Please retry shortly.",
};

function defaultNavigate(url: string) {
  window.location.assign(url);
}

async function readCheckoutResponse(
  response: Response,
): Promise<CheckoutResponse> {
  try {
    const json = (await response.json()) as unknown;
    if (json && typeof json === "object") {
      return json as CheckoutResponse;
    }
  } catch {
    // Handle non-JSON error payloads gracefully.
  }
  return {};
}

export function PricingPlanCta({
  plan,
  cta,
  className,
  onNavigate,
}: PricingPlanCtaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = onNavigate ?? defaultNavigate;

  if (plan === "FREE") {
    return (
      <Link href="/signup" className={className}>
        {cta}
      </Link>
    );
  }

  async function handleCheckout() {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const payload = await readCheckoutResponse(response);

      if (!response.ok) {
        if (response.status === 401 || payload.code === "WORKSPACE_REQUIRED") {
          navigate(PRICING_SIGNUP_REDIRECT);
          return;
        }

        setError(
          CHECKOUT_ERROR_COPY[payload.code ?? ""] ??
            payload.error ??
            `Failed to start checkout (HTTP ${response.status}).`,
        );
        return;
      }

      if (!payload.checkoutUrl) {
        setError("Checkout link was missing from billing response.");
        return;
      }

      navigate(payload.checkoutUrl);
    } catch {
      setError("Network error while starting checkout. Please retry.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? "Redirecting..." : cta}
      </button>
      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
