jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

import { requireWorkspaceSessionForPage } from "@/lib/server/page-auth";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

const mockedNavigation = jest.requireMock("next/navigation") as {
  redirect: jest.Mock;
};

describe("requireWorkspaceSessionForPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNavigation.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  test("returns workspace session on success", async () => {
    const session = { workspaceId: "ws_1", user: { id: "u_1" } };
    mockedGuards.requireWorkspaceSession.mockResolvedValue(session);

    await expect(requireWorkspaceSessionForPage()).resolves.toEqual(session);
    expect(mockedNavigation.redirect).not.toHaveBeenCalled();
  });

  test("redirects to login for unauthenticated session errors", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("UNAUTHORIZED"),
    );

    await expect(requireWorkspaceSessionForPage()).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mockedNavigation.redirect).toHaveBeenCalledWith("/login");
  });

  test("redirects to onboarding when workspace is missing", async () => {
    mockedGuards.requireWorkspaceSession.mockRejectedValue(
      new Error("WORKSPACE_REQUIRED"),
    );

    await expect(requireWorkspaceSessionForPage()).rejects.toThrow(
      "REDIRECT:/onboarding",
    );
    expect(mockedNavigation.redirect).toHaveBeenCalledWith("/onboarding");
  });

  test("rethrows unknown auth errors", async () => {
    const error = new Error("SOMETHING_ELSE");
    mockedGuards.requireWorkspaceSession.mockRejectedValue(error);

    await expect(requireWorkspaceSessionForPage()).rejects.toThrow(
      "SOMETHING_ELSE",
    );
    expect(mockedNavigation.redirect).not.toHaveBeenCalled();
  });
});
