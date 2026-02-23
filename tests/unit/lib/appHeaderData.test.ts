jest.mock("@/lib/server/auth-guards", () => ({
  requireSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: {
      findFirst: jest.fn(),
    },
  },
}));

import { loadAppHeaderData, workspacePlanLabel } from "@/lib/appHeaderData";

const mockedAuthGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireSession: jest.Mock;
};

const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  workspaceMember: {
    findFirst: jest.Mock;
  };
};

describe("app header data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuthGuards.requireSession.mockResolvedValue({
      user: { id: "u_1", email: "test@example.com" },
    });
    mockedPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspace: {
        id: "ws_1",
        name: "ReditFast HQ",
        plan: "PRO",
      },
    });
  });

  test("maps plan labels consistently", () => {
    expect(workspacePlanLabel("FREE")).toBe("Free plan");
    expect(workspacePlanLabel("PRO")).toBe("Pro plan");
    expect(workspacePlanLabel("ENTERPRISE")).toBe("Enterprise plan");
    expect(workspacePlanLabel(undefined)).toBe("Free plan");
  });

  test("returns workspace name and plan label when workspace exists", async () => {
    const data = await loadAppHeaderData();

    expect(data).toEqual({
      workspaceId: "ws_1",
      workspaceName: "ReditFast HQ",
      planLabel: "Pro plan",
      hasAdvancedAnalytics: true,
      hasSmartFinder: true,
    });
    expect(mockedPrisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: { userId: "u_1" },
      orderBy: { createdAt: "asc" },
      select: {
        workspace: {
          select: { id: true, name: true, plan: true },
        },
      },
    });
  });

  test("falls back when workspace membership is missing", async () => {
    mockedPrisma.workspaceMember.findFirst.mockResolvedValue(null);

    const data = await loadAppHeaderData();

    expect(data).toEqual({
      workspaceId: null,
      workspaceName: "Workspace setup",
      planLabel: "Setup pending",
      hasAdvancedAnalytics: false,
      hasSmartFinder: false,
    });
  });

  test("falls back when workspace name is empty", async () => {
    mockedPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspace: {
        id: "ws_1",
        name: "   ",
        plan: "ENTERPRISE",
      },
    });

    const data = await loadAppHeaderData();

    expect(data.workspaceName).toBe("Workspace");
    expect(data.planLabel).toBe("Enterprise plan");
    expect(data.hasAdvancedAnalytics).toBe(true);
    expect(data.hasSmartFinder).toBe(true);
  });

  test("propagates auth/page redirect errors", async () => {
    mockedAuthGuards.requireSession.mockRejectedValue(
      new Error("REDIRECT:/login"),
    );

    await expect(loadAppHeaderData()).rejects.toThrow("REDIRECT:/login");
  });
});
