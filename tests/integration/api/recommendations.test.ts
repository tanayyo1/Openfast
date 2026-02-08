import { Prisma, PrismaClient } from "@prisma/client";
import { POST as generateRecommendations } from "@/app/api/projects/[id]/recommend-subreddits/route";
import { GET as listRecommendations } from "@/app/api/projects/[id]/recommendations/route";
import { POST as selectRecommendations } from "@/app/api/projects/[id]/recommendations/select/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueSubredditIngestJob: jest
    .fn()
    .mockResolvedValue({ id: "job_ingest_1" }),
  enqueueSubredditComputeTimeWindowsJob: jest
    .fn()
    .mockResolvedValue({ id: "job_windows_1" }),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Recommendations APIs", () => {
  let workspaceId: string;
  let userId: string;
  let counter = 0;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) throw new Error("Seed user missing. Ensure prisma db seed ran.");

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws)
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");

    userId = user.id;
    workspaceId = ws.workspaceId;
  });

  beforeEach(() => {
    mockedGuards.requireWorkspaceSession.mockReset();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeProject() {
    counter += 1;
    const suffix = `${Date.now()}_${counter}`;
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: `Reco Project ${suffix}`,
        description: "Recommendation integration test",
        niche: "saas marketing",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });
    return project.id;
  }

  async function cleanupProject(projectId: string) {
    await prisma.subredditRecommendation.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  }

  test("generate -> list -> select recommendation flow", async () => {
    const projectId = await makeProject();
    try {
      const generateRes = await generateRecommendations(
        new Request(
          `http://test.local/api/projects/${projectId}/recommend-subreddits`,
          { method: "POST" },
        ),
        { params: { id: projectId } },
      );
      expect(generateRes.status).toBe(200);
      const generated = (await readJson(generateRes)) as {
        count: number;
        items: Array<{ subredditId: string }>;
      };
      expect(generated.count).toBeGreaterThan(0);
      expect(generated.items[0]?.subredditId).toBeTruthy();

      const listRes = await listRecommendations(
        new Request(
          `http://test.local/api/projects/${projectId}/recommendations`,
        ),
        { params: { id: projectId } },
      );
      expect(listRes.status).toBe(200);
      const listed = (await readJson(listRes)) as {
        count: number;
        items: Array<{ subredditId: string; selected: boolean }>;
      };
      expect(listed.count).toBe(generated.count);
      expect(listed.items.every((i) => i.selected === false)).toBe(true);

      const toSelect = listed.items.slice(0, 2).map((i) => i.subredditId);
      const selectRes = await selectRecommendations(
        new Request(
          `http://test.local/api/projects/${projectId}/recommendations/select`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subredditIds: toSelect }),
          },
        ),
        { params: { id: projectId } },
      );
      expect(selectRes.status).toBe(200);
      const selected = (await readJson(selectRes)) as {
        selectedCount: number;
        items: Array<{ subredditId: string }>;
      };
      expect(selected.selectedCount).toBe(toSelect.length);
      expect(selected.items.map((i) => i.subredditId).sort()).toEqual(
        [...toSelect].sort(),
      );
    } finally {
      await cleanupProject(projectId);
    }
  });

  test("returns 404 for unknown project", async () => {
    const res = await listRecommendations(
      new Request("http://test.local/api/projects/missing/recommendations"),
      { params: { id: "missing" } },
    );
    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROJECT_NOT_FOUND");
  });
});
