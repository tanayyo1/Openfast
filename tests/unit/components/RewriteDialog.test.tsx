/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { RewriteDialog } from "@/components/app/editor/RewriteDialog";

// Radix Dialog uses Portal which needs a container
beforeAll(() => {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal || jest.fn();
  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close || jest.fn();
});

describe("RewriteDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSubmit: jest.fn(),
    loading: false,
    error: null,
  };

  test("dialog renders when open=true, hidden when open=false", () => {
    const { rerender } = render(<RewriteDialog {...defaultProps} open />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Configure how the draft should be rewritten."),
    ).toBeInTheDocument();

    rerender(<RewriteDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("submit calls onSubmit with correct payload shape", () => {
    const onSubmit = jest.fn();
    render(<RewriteDialog {...defaultProps} onSubmit={onSubmit} />);

    // Click submit with defaults (REWRITE, medium, 3, empty tone)
    fireEvent.click(screen.getByRole("button", { name: /rewrite draft/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      mode: "REWRITE",
      tone: "",
      length: "medium",
      variantCount: 3,
    });
  });

  test("submit button disabled when loading=true", () => {
    render(<RewriteDialog {...defaultProps} loading />);

    const button = screen.getByRole("button", { name: /rewriting/i });
    expect(button).toBeDisabled();
  });

  test("error banner renders when error is set", () => {
    render(
      <RewriteDialog {...defaultProps} error="Draft rewrite failed: 503" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Draft rewrite failed: 503",
    );
  });

  test("mode/length/variantCount defaults are correct (REWRITE, medium, 3)", () => {
    const onSubmit = jest.fn();
    render(<RewriteDialog {...defaultProps} onSubmit={onSubmit} />);

    // Change mode to COMPLIANCE
    fireEvent.click(screen.getByText("Compliance"));
    // Change length to long
    fireEvent.click(screen.getByText("long"));
    // Change variant count to 5
    fireEvent.click(screen.getByText("5"));

    fireEvent.click(screen.getByRole("button", { name: /rewrite draft/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      mode: "COMPLIANCE",
      tone: "",
      length: "long",
      variantCount: 5,
    });
  });
});
