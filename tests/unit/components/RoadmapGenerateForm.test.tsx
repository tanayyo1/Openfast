/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RoadmapGenerateForm } from "@/components/roadmaps/RoadmapGenerateForm";

const pushMock = jest.fn();
const fetchMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("RoadmapGenerateForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  test("shows fallback error for non-JSON failure response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not-json");
      },
    });

    render(
      <RoadmapGenerateForm
        projects={[{ id: "p_1", name: "Project One" }]}
        accounts={[{ id: "a_1", redditUsername: "user1", safetyTier: "NEW" }]}
        initialProjectId="p_1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to generate roadmap."),
      ).toBeInTheDocument();
    });
  });

  test("shows plan-limit message on 403 response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Roadmap horizon exceeds plan allowance" }),
    });

    render(
      <RoadmapGenerateForm
        projects={[{ id: "p_1", name: "Project One" }]}
        accounts={[{ id: "a_1", redditUsername: "user1", safetyTier: "NEW" }]}
        initialProjectId="p_1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText("Roadmap horizon exceeds plan allowance"),
      ).toBeInTheDocument();
    });
  });

  test("navigates to roadmap detail on successful creation", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ roadmap: { id: "rm_1" } }),
    });

    render(
      <RoadmapGenerateForm
        projects={[{ id: "p_1", name: "Project One" }]}
        accounts={[{ id: "a_1", redditUsername: "user1", safetyTier: "NEW" }]}
        initialProjectId="p_1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/roadmaps/rm_1");
    });
  });
});
