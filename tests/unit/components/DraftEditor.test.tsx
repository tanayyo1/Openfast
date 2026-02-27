/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { DraftEditor } from "@/components/app/editor/DraftEditor";

describe("DraftEditor edge cases", () => {
  test("renders safely when variants list is empty", () => {
    render(<DraftEditor variants={[]} />);

    expect(
      screen.getByText(
        /no generated variants yet\. you can still edit manually/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Risk: Low")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
  });

  test("clamps out-of-range initialSelectedIndex to nearest valid variant", () => {
    render(
      <DraftEditor
        variants={[
          {
            title: "Variant A",
            body: "Body A",
            riskScore: 10,
            notes: ["note a"],
          },
          {
            title: "Variant B",
            body: "Body B",
            riskScore: 45,
            notes: ["note b"],
          },
        ]}
        initialSelectedIndex={99}
      />,
    );

    const titleInput = screen.getByLabelText("Title") as HTMLInputElement;
    const bodyInput = screen.getByLabelText("Body") as HTMLTextAreaElement;

    expect(titleInput.value).toBe("Variant B");
    expect(bodyInput.value).toBe("Body B");
  });

  test("passes latest editor values to request approval action", () => {
    const onRequestApproval = jest.fn();
    render(
      <DraftEditor
        variants={[
          {
            title: "Variant A",
            body: "Body A",
            riskScore: 10,
            notes: ["note a"],
          },
        ]}
        onRequestApproval={onRequestApproval}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated title" },
    });
    fireEvent.change(screen.getByLabelText("Body"), {
      target: { value: "Updated body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request approval" }));

    expect(onRequestApproval).toHaveBeenCalledWith({
      title: "Updated title",
      body: "Updated body",
    });
  });

  test("disables editor actions when busy", () => {
    render(
      <DraftEditor
        variants={[
          {
            title: "Variant A",
            body: "Body A",
            riskScore: 10,
            notes: ["note a"],
          },
        ]}
        onSave={jest.fn()}
        onRequestApproval={jest.fn()}
        onApprove={jest.fn()}
        onRewrite={jest.fn()}
        isBusy
      />,
    );

    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Request approval" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rewrite" })).toBeDisabled();
  });
});
