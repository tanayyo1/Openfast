/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import OpportunitiesPage from "@/app/(app)/opportunities/page";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function asUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("OpportunitiesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("clears stale error after successful silent refresh", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, { items: [{ id: "p_1", name: "Project 1" }] }),
      )
      .mockImplementationOnce(async () =>
        mockJsonResponse(500, { error: "Feed temporarily unavailable" }),
      )
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, { count: 0, items: [] }),
      );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(<OpportunitiesPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Feed temporarily unavailable"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh feed" }));

    await waitFor(() => {
      expect(
        screen.queryByText("Feed temporarily unavailable"),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("No opportunities found")).toBeInTheDocument();
    });
  });

  test("handles OPPORTUNITY_NOT_FOUND as stale and refreshes feed", async () => {
    let resolveCreate: ((value: unknown) => void) | null = null;
    const createPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });

    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, {
          items: [
            { id: "p_1", name: "Project 1" },
            { id: "p_2", name: "Project 2" },
          ],
        }),
      )
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, {
          count: 1,
          items: [
            {
              id: "opp_1",
              subredditId: "sub_1",
              subredditName: "startups",
              subredditTitle: "Startups",
              title: "Thread title",
              permalink: "https://reddit.com/r/startups/comments/abc123",
              author: "author1",
              opportunityScore: 0.8,
              relevanceScore: 0.7,
              velocityScore: 0.6,
              riskScore: 0.2,
              velocity: "Medium",
              risk: "Low",
            },
          ],
        }),
      )
      .mockImplementationOnce(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "POST") {
            return (await createPromise) as ReturnType<typeof mockJsonResponse>;
          }
          throw new Error("Unexpected non-POST third call");
        },
      )
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, { count: 0, items: [] }),
      );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(<OpportunitiesPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create comment draft" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Create comment draft" }),
    );

    const scopeSelect = screen.getByRole("combobox") as HTMLSelectElement;
    expect(scopeSelect.disabled).toBe(true);

    await act(async () => {
      resolveCreate?.(
        mockJsonResponse(404, {
          error: "Opportunity not found",
          code: "OPPORTUNITY_NOT_FOUND",
        }),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("No opportunities found")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Failed to create draft from opportunity"),
    ).not.toBeInTheDocument();

    const opportunityLoads = fetchMock.mock.calls.filter(([input, init]) => {
      const method = init?.method ?? "GET";
      return method === "GET" && asUrl(input).includes("/opportunities");
    });
    expect(opportunityLoads).toHaveLength(2);
  });

  test("preserves create-action error while silent feed refresh completes", async () => {
    let resolveRefresh:
      | ((value: ReturnType<typeof mockJsonResponse>) => void)
      | null = null;
    const refreshPromise = new Promise<ReturnType<typeof mockJsonResponse>>(
      (resolve) => {
        resolveRefresh = resolve;
      },
    );

    const fetchMock = jest
      .fn()
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, { items: [{ id: "p_1", name: "Project 1" }] }),
      )
      .mockImplementationOnce(async () =>
        mockJsonResponse(200, {
          count: 1,
          items: [
            {
              id: "opp_1",
              subredditId: "sub_1",
              subredditName: "startups",
              subredditTitle: "Startups",
              title: "Thread title",
              permalink: "https://reddit.com/r/startups/comments/abc123",
              author: "author1",
              opportunityScore: 0.8,
              relevanceScore: 0.7,
              velocityScore: 0.6,
              riskScore: 0.2,
              velocity: "Medium",
              risk: "Low",
            },
          ],
        }),
      )
      .mockImplementationOnce(async () => refreshPromise)
      .mockImplementationOnce(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method !== "POST") {
            throw new Error("Expected POST request for create flow");
          }
          return mockJsonResponse(409, {
            error: "No active roadmap found for this project",
            code: "ACTIVE_ROADMAP_REQUIRED",
          });
        },
      );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(<OpportunitiesPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create comment draft" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh feed" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create comment draft" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "No active roadmap found for this project. Generate a roadmap first.",
        ),
      ).toBeInTheDocument();
    });

    await act(async () => {
      resolveRefresh?.(
        mockJsonResponse(200, {
          count: 1,
          items: [
            {
              id: "opp_1",
              subredditId: "sub_1",
              subredditName: "startups",
              subredditTitle: "Startups",
              title: "Thread title",
              permalink: "https://reddit.com/r/startups/comments/abc123",
              author: "author1",
              opportunityScore: 0.8,
              relevanceScore: 0.7,
              velocityScore: 0.6,
              riskScore: 0.2,
              velocity: "Medium",
              risk: "Low",
            },
          ],
        }),
      );
      await Promise.resolve();
    });

    expect(
      screen.getByText(
        "No active roadmap found for this project. Generate a roadmap first.",
      ),
    ).toBeInTheDocument();
  });
});
