/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { AppSidebar } from "@/components/app/AppSidebar";

const usePathnameMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

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

describe("AppSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("marks parent nav item active for nested routes", () => {
    usePathnameMock.mockReturnValue("/content/drafts/d_123");
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("marks nav item active on exact href match", () => {
    usePathnameMock.mockReturnValue("/content");
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("does not mark dashboard active for nested paths", () => {
    usePathnameMock.mockReturnValue("/dashboard/overview");
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("marks quick links active when pathname matches", () => {
    usePathnameMock.mockReturnValue("/settings");
    render(<AppSidebar />);

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
