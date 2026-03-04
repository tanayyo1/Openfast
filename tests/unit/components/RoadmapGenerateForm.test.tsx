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

  test("shows detailed horizon message when API returns ROADMAP_HORIZON_LIMIT", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "ROADMAP_HORIZON_LIMIT",
        details: { requested: 30, maxAllowed: 7 },
      }),
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
        screen.getByText("Your plan allows up to 7 roadmap days."),
      ).toBeInTheDocument();
    });
  });

  test("clamps horizon days to max bound before API call", async () => {
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

    fireEvent.change(screen.getByLabelText("Horizon days"), {
      target: { value: "120" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const fetchBody = fetchMock.mock.calls[0]?.[1]?.body as string;
    const payload = JSON.parse(fetchBody);
    expect(payload.horizonDays).toBe(60);
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

  test("renders onboarding mode with step header and back link to connect step", () => {
    render(
      <RoadmapGenerateForm
        projects={[{ id: "p_1", name: "Project One" }]}
        accounts={[{ id: "a_1", redditUsername: "user1", safetyTier: "NEW" }]}
        initialProjectId="p_1"
        mode="onboarding"
      />,
    );

    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/onboarding/connect-reddit?projectId=p_1",
    );
  });

  test("shows create-project CTA when no projects exist", () => {
    render(
      <RoadmapGenerateForm
        projects={[]}
        accounts={[{ id: "a_1", redditUsername: "user1", safetyTier: "NEW" }]}
        initialProjectId=""
      />,
    );

    expect(
      screen.getByRole("link", { name: "Create project" }),
    ).toHaveAttribute("href", "/onboarding/create-project");
  });

  test("recovers selection after PROJECT_NOT_FOUND response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        code: "PROJECT_NOT_FOUND",
        error: "Project not found",
      }),
    });

    render(
      <RoadmapGenerateForm
        projects={[
          { id: "p_1", name: "Project One" },
          { id: "p_2", name: "Project Two" },
        ]}
        accounts={[{ id: "a_1", redditUsername: "user1", safetyTier: "NEW" }]}
        initialProjectId="missing_project"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Project no longer exists. Select another project and retry.",
        ),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Project")).toHaveValue("p_1");
    });
  });
});
