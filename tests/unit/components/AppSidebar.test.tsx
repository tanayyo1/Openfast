/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app/AppSidebar";

const requireSessionMock = jest.fn();
const findFirstMock = jest.fn();
const getWorkspaceEntitlementsMock = jest.fn();

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: () => requireSessionMock(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

jest.mock("@/lib/billing/quota", () => ({
  getWorkspaceEntitlements: (...args: unknown[]) =>
    getWorkspaceEntitlementsMock(...args),
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: "user_1" } });
    findFirstMock.mockResolvedValue({ workspaceId: "ws_1" });
    getWorkspaceEntitlementsMock.mockResolvedValue({
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
    });
  });

  test("renders core and entitlement-gated nav links", async () => {
    render(await AppSidebar());

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(
      screen.getByRole("link", { name: "Brand monitoring" }),
    ).toHaveAttribute("href", "/brand-monitoring");
    expect(screen.getByRole("link", { name: "Opportunities" })).toHaveAttribute(
      "href",
      "/opportunities",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  test("hides gated links when workspace has no paid entitlements", async () => {
    getWorkspaceEntitlementsMock.mockResolvedValue({
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
    });

    render(await AppSidebar());

    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Brand monitoring" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Opportunities" }),
    ).not.toBeInTheDocument();
  });

  test("recovers from auth-like session errors", async () => {
    requireSessionMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    render(await AppSidebar());

    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "href",
      "/content",
    );
    expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  });

  test("throws on unexpected session errors", async () => {
    requireSessionMock.mockRejectedValue(new Error("DB_DOWN"));
    await expect(AppSidebar()).rejects.toThrow("DB_DOWN");
  });
});
