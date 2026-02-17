jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/recommendations/generate", () => ({
  generateProjectRecommendations: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    roadmap: { findMany: jest.fn() },
    project: { findFirst: jest.fn() },
    projectSubredditRecommendation: { findMany: jest.fn() },
    projectPainPoint: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { GET as listRoadmaps } from "@/app/api/roadmaps/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  roadmap: { findMany: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("roadmaps route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("returns 400 for cursor with invalid createdAt value", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "not-a-date", id: "rm_1" }),
      "utf8",
    ).toString("base64url");

    const res = await listRoadmaps(
      new Request(`http://test.local/api/roadmaps?cursor=${cursor}`),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("INVALID_CURSOR");
    expect(mockedPrisma.roadmap.findMany).not.toHaveBeenCalled();
  });
});
