/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MobilePreviewCard } from "@/components/app/editor/MobilePreviewCard";

describe("MobilePreviewCard", () => {
  test("renders post title and trims preview to first four body lines", () => {
    render(
      <MobilePreviewCard
        taskType="Post"
        subreddit="startups"
        title="Shipping a faster onboarding flow"
        body={"L1\nL2\nL3\nL4\nL5"}
      />,
    );

    expect(screen.getByText("Mobile preview")).toBeInTheDocument();
    expect(screen.getByText("r/startups")).toBeInTheDocument();
    expect(
      screen.getByText("Shipping a faster onboarding flow"),
    ).toBeInTheDocument();
    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("L4")).toBeInTheDocument();
    expect(screen.queryByText("L5")).not.toBeInTheDocument();
  });

  test("renders comment-specific preview without post title", () => {
    render(
      <MobilePreviewCard
        taskType="Comment"
        subreddit="r/SaaS"
        title="Ignored title"
        body="Helpful comment body"
      />,
    );

    expect(screen.getByText("Reply preview")).toBeInTheDocument();
    expect(screen.queryByText("Ignored title")).not.toBeInTheDocument();
    expect(screen.getByText("Helpful comment body")).toBeInTheDocument();
  });
});
