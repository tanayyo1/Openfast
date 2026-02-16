jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    draft: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import {
  GET as getDraft,
  PATCH as patchDraft,
} from "@/app/api/drafts/[id]/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  draft: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("drafts [id] route (RED-63)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
  });

  test("PATCH re-runs structure validation when body/title changes", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      status: "DRAFT",
      title: "How we improved activation by 2x",
      body: "Long value-first post body before product mention and link in later section.",
    });

    mockedPrisma.draft.update.mockResolvedValueOnce({
      id: "dr_1",
      status: "DRAFT",
      title: "How we improved activation by 2x",
      body: "Updated body",
      variants: null,
      riskScore: 0,
      updatedAt: new Date().toISOString(),
    });

    const res = await patchDraft(
      new Request("http://test.local/api/drafts/dr_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: "Updated body with value before product mention.",
        }),
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(200);
    expect(mockedPrisma.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Updated body with value before product mention.",
          structureValidation: expect.objectContaining({
            grade: expect.stringMatching(/^[A-F]$/),
            score: expect.any(Number),
            warnings: expect.any(Array),
            rewriteSuggestions: expect.any(Array),
          }),
        }),
      }),
    );
  });

  test("GET includeStructure=1 returns computed structure payload", async () => {
    mockedPrisma.draft.findFirst.mockResolvedValueOnce({
      id: "dr_1",
      projectId: "p_1",
      taskId: "t_1",
      subredditId: null,
      type: "POST",
      title: "3 things that improved retention",
      body: "We tested onboarding experiments and saw meaningful lift. Product mention appears later with link.",
      mediaUrls: [],
      variants: null,
      generationParams: null,
      status: "DRAFT",
      riskScore: 0,
      riskReasons: [],
      suggestedFixes: null,
      structureValidation: null,
      approvedAt: null,
      approvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await getDraft(
      new Request("http://test.local/api/drafts/dr_1?includeStructure=1"),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      structure: {
        grade: string;
        score: number;
        warnings: unknown[];
        rewriteSuggestions: unknown[];
      };
    };
    expect(json.structure.grade).toMatch(/^[A-F]$/);
    expect(typeof json.structure.score).toBe("number");
    expect(Array.isArray(json.structure.warnings)).toBe(true);
    expect(Array.isArray(json.structure.rewriteSuggestions)).toBe(true);
  });
});
