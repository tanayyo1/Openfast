/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HealthAccountActions } from "@/components/app/health/HealthAccountActions";

const refreshMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

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

function deferredResponse() {
  let resolve!: (value: MockResponse) => void;
  const promise = new Promise<MockResponse>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("HealthAccountActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("disables visibility/history actions with explicit helper state", () => {
    render(
      <HealthAccountActions
        accountId="ra_1"
        latestPermalink={null}
        visibilityHistory={[]}
        healthHistory={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Run visibility check" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "View history" })).toBeDisabled();
    expect(
      screen.getByText(
        /No published permalink available yet\. Publish at least one post\/comment before running visibility checks\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh health snapshot" }),
    ).toBeEnabled();
  });

  test("runs health refresh action and shows queued notice", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        refreshQueued: true,
        latestSnapshot: null,
        warnings: [],
      }),
    );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(
      <HealthAccountActions
        accountId="ra_1"
        latestPermalink={null}
        visibilityHistory={[]}
        healthHistory={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh health snapshot" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reddit/accounts/ra_1/health",
        {
          cache: "no-store",
        },
      );
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          "Health snapshot refresh queued. Check back in a minute.",
        ),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  test("locks visibility action while health refresh is in flight", async () => {
    const pendingRefresh = deferredResponse();
    const fetchMock = jest
      .fn()
      .mockImplementation(() => pendingRefresh.promise);
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(
      <HealthAccountActions
        accountId="ra_1"
        latestPermalink="https://www.reddit.com/r/test/comments/abc123/example/"
        visibilityHistory={[]}
        healthHistory={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh health snapshot" }),
    );

    expect(
      screen.getByRole("button", { name: "Refreshing..." }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Run visibility check" }),
    ).toBeDisabled();

    pendingRefresh.resolve(
      jsonResponse(200, {
        refreshQueued: false,
        latestSnapshot: { healthScore: 61 },
        warnings: [],
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Latest health score: 61.")).toBeInTheDocument();
    });
  });

  test("prevents duplicate refresh requests on rapid repeated clicks", async () => {
    const pendingRefresh = deferredResponse();
    const fetchMock = jest
      .fn()
      .mockImplementation(() => pendingRefresh.promise);
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(
      <HealthAccountActions
        accountId="ra_1"
        latestPermalink={null}
        visibilityHistory={[]}
        healthHistory={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh health snapshot" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refreshing..." }));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    pendingRefresh.resolve(
      jsonResponse(200, {
        refreshQueued: false,
        latestSnapshot: { healthScore: 77 },
        warnings: [],
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Latest health score: 77.")).toBeInTheDocument();
    });
  });

  test("runs visibility check and refreshes server data", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        check: { result: "OK" },
      }),
    );
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(
      <HealthAccountActions
        accountId="ra_1"
        latestPermalink="https://www.reddit.com/r/test/comments/abc123/example/"
        visibilityHistory={[]}
        healthHistory={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Run visibility check" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reddit/accounts/ra_1/visibility-check",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    await waitFor(() => {
      expect(
        screen.getByText("Visibility check complete: ok."),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  test("handles non-json error response from visibility check endpoint", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("invalid json");
      },
    } satisfies MockResponse);
    (global as { fetch?: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    render(
      <HealthAccountActions
        accountId="ra_1"
        latestPermalink="https://www.reddit.com/r/test/comments/abc123/example/"
        visibilityHistory={[]}
        healthHistory={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Run visibility check" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to run visibility check (HTTP 502)."),
      ).toBeInTheDocument();
    });
    expect(refreshMock).toHaveBeenCalledTimes(0);
  });
});
