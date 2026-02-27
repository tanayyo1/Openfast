import { Prisma, PrismaClient } from "@prisma/client";
import {
  GET as listCampaigns,
  POST as createCampaign,
} from "@/app/api/reddit/ads/campaigns/route";
import { PATCH as updateCampaign } from "@/app/api/reddit/ads/campaigns/[id]/route";

jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/queue/enqueue", () => ({
  enqueueRedditAdsSyncJob: jest
    .fn()
    .mockResolvedValue({ id: "job_ads_sync_1" }),
}));

const prisma = new PrismaClient();

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedQueue = jest.requireMock("@/lib/queue/enqueue") as {
  enqueueRedditAdsSyncJob: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("Reddit Ads campaigns API", () => {
  let workspaceId: string;
  let userId: string;
  let projectId: string;
  let redditAccountId: string;
  const createdCampaignIds: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "seed@reditfast.local" },
      select: { id: true },
    });
    if (!user) {
      throw new Error("Seed user missing. Ensure prisma db seed ran.");
    }

    const ws = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!ws) {
      throw new Error("Seed workspace missing. Ensure prisma db seed ran.");
    }

    userId = user.id;
    workspaceId = ws.workspaceId;

    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: userId },
      workspaceId,
    });

    const createdProject = await prisma.project.create({
      data: {
        workspaceId,
        name: "Ads Project",
        description: "Ads integration test project",
        niche: "saas",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });
    projectId = createdProject.id;

    const createdAccount = await prisma.redditAccount.create({
      data: {
        workspaceId,
        redditUsername: `ads_account_${Date.now()}`,
        redditUserId: null,
        accessToken: "enc_access",
        refreshToken: "enc_refresh",
        tokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ["read", "submit"],
        accountAge: 365,
        lastSyncAt: new Date(),
      },
      select: { id: true },
    });
    redditAccountId = createdAccount.id;
  });

  beforeEach(() => {
    mockedQueue.enqueueRedditAdsSyncJob.mockReset();
    mockedQueue.enqueueRedditAdsSyncJob.mockResolvedValue({
      id: `job_ads_sync_${Date.now()}`,
    });
  });

  afterAll(async () => {
    if (createdCampaignIds.length > 0) {
      await prisma.redditAdCampaign.deleteMany({
        where: { id: { in: createdCampaignIds } },
      });
    }
    await prisma.redditAccount.delete({ where: { id: redditAccountId } });
    await prisma.project.delete({ where: { id: projectId } });
    await prisma.$disconnect();
  });

  test("create campaign normalizes targets and persists workspace-scoped data", async () => {
    const req = new Request("http://test.local/api/reddit/ads/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        redditAccountId,
        name: "Acquisition Q1",
        objective: "TRAFFIC",
        dailyBudgetCents: 2500,
        lifetimeBudgetCents: 20000,
        targetSubreddits: ["r/startups", "Startups", "r/SaaS", "bad subreddit"],
        targetCountries: ["us", "CA", "ca", "x1"],
      }),
    });

    const res = await createCampaign(req);
    expect(res.status).toBe(201);

    const json = (await readJson(res)) as {
      campaign: {
        id: string;
        targetSubreddits: string[];
        targetCountries: string[];
      };
    };
    createdCampaignIds.push(json.campaign.id);
    expect(json.campaign.targetSubreddits).toEqual(["startups", "saas"]);
    expect(json.campaign.targetCountries).toEqual(["US", "CA"]);
  });

  test("activation enforces creative requirements", async () => {
    const draftRes = await createCampaign(
      new Request("http://test.local/api/reddit/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          redditAccountId,
          name: "Needs Creative",
          objective: "CONVERSIONS",
          dailyBudgetCents: 3000,
          targetSubreddits: ["startups"],
        }),
      }),
    );
    const draftJson = (await readJson(draftRes)) as {
      campaign: { id: string };
    };
    createdCampaignIds.push(draftJson.campaign.id);

    const activateRes = await updateCampaign(
      new Request(
        `http://test.local/api/reddit/ads/campaigns/${draftJson.campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        },
      ),
      { params: { id: draftJson.campaign.id } },
    );
    expect(activateRes.status).toBe(409);
    const activateJson = (await readJson(activateRes)) as { code: string };
    expect(activateJson.code).toBe("CREATIVE_REQUIRED");
    expect(mockedQueue.enqueueRedditAdsSyncJob).not.toHaveBeenCalled();
  });

  test("cannot activate campaigns for archived projects", async () => {
    const archivedProject = await prisma.project.create({
      data: {
        workspaceId,
        name: "Archived Ads Project",
        description: "Archived project activation guard test",
        niche: "saas",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });

    try {
      const campaign = await prisma.redditAdCampaign.create({
        data: {
          workspaceId,
          projectId: archivedProject.id,
          redditAccountId,
          name: "Archived Project Campaign",
          objective: "TRAFFIC",
          status: "DRAFT",
          dailyBudgetCents: 2500,
          targetSubreddits: ["startups"],
          headline: "Launch now",
          body: "Body copy",
          destinationUrl: "https://example.com",
        },
        select: { id: true },
      });
      createdCampaignIds.push(campaign.id);

      await prisma.project.update({
        where: { id: archivedProject.id },
        data: { status: "ARCHIVED" },
      });

      const activateRes = await updateCampaign(
        new Request(
          `http://test.local/api/reddit/ads/campaigns/${campaign.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACTIVE" }),
          },
        ),
        { params: { id: campaign.id } },
      );
      expect(activateRes.status).toBe(409);
      const activateJson = (await readJson(activateRes)) as { code: string };
      expect(activateJson.code).toBe("INVALID_PROJECT_STATE");
    } finally {
      await prisma.project.delete({ where: { id: archivedProject.id } });
    }
  });

  test("campaign list is workspace scoped", async () => {
    const otherWorkspace = await prisma.workspace.create({
      data: { ownerId: userId, name: "Other Ads Workspace" },
      select: { id: true },
    });
    const otherProject = await prisma.project.create({
      data: {
        workspaceId: otherWorkspace.id,
        name: "Other Ads Project",
        description: "Hidden campaign project",
        niche: "other",
        goals: { primary: "traffic", targets: [], kpis: [] },
        brandVoice: { tone: "neutral", do: [], dont: [] },
        constraints: Prisma.DbNull,
      },
      select: { id: true },
    });
    const otherCampaign = await prisma.redditAdCampaign.create({
      data: {
        workspaceId: otherWorkspace.id,
        projectId: otherProject.id,
        name: "Other Workspace Campaign",
        objective: "TRAFFIC",
        status: "DRAFT",
        dailyBudgetCents: 1500,
        targetSubreddits: ["startups"],
      },
      select: { id: true },
    });

    const listRes = await listCampaigns(
      new Request("http://test.local/api/reddit/ads/campaigns"),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await readJson(listRes)) as {
      items: Array<{ id: string }>;
    };
    expect(listJson.items.some((item) => item.id === otherCampaign.id)).toBe(
      false,
    );

    await prisma.redditAdCampaign.delete({ where: { id: otherCampaign.id } });
    await prisma.project.delete({ where: { id: otherProject.id } });
    await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
  });

  test("inactive account can still pause an active campaign", async () => {
    const draftRes = await createCampaign(
      new Request("http://test.local/api/reddit/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          redditAccountId,
          name: "Pause With Inactive Account",
          objective: "TRAFFIC",
          dailyBudgetCents: 3000,
          targetSubreddits: ["startups"],
          headline: "Ad headline",
          body: "Ad body",
          destinationUrl: "https://example.com",
        }),
      }),
    );
    expect(draftRes.status).toBe(201);
    const draftJson = (await readJson(draftRes)) as {
      campaign: { id: string };
    };
    createdCampaignIds.push(draftJson.campaign.id);

    const activateRes = await updateCampaign(
      new Request(
        `http://test.local/api/reddit/ads/campaigns/${draftJson.campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        },
      ),
      { params: { id: draftJson.campaign.id } },
    );
    expect(activateRes.status).toBe(200);
    expect(mockedQueue.enqueueRedditAdsSyncJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        campaignId: draftJson.campaign.id,
        status: "ACTIVE",
        action: "UPSERT",
        trigger: "STATUS_CHANGE",
      }),
    );

    await prisma.redditAccount.update({
      where: { id: redditAccountId },
      data: { isActive: false },
    });

    try {
      const pauseRes = await updateCampaign(
        new Request(
          `http://test.local/api/reddit/ads/campaigns/${draftJson.campaign.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "PAUSED" }),
          },
        ),
        { params: { id: draftJson.campaign.id } },
      );
      expect(pauseRes.status).toBe(200);
      const pauseJson = (await readJson(pauseRes)) as {
        campaign: { status: string };
      };
      expect(pauseJson.campaign.status).toBe("PAUSED");
      expect(mockedQueue.enqueueRedditAdsSyncJob).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          campaignId: draftJson.campaign.id,
          status: "PAUSED",
          action: "PAUSE",
          trigger: "STATUS_CHANGE",
        }),
      );
    } finally {
      await prisma.redditAccount.update({
        where: { id: redditAccountId },
        data: { isActive: true },
      });
    }
  });

  test("draft-only edits do not enqueue external sync", async () => {
    const draftRes = await createCampaign(
      new Request("http://test.local/api/reddit/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          redditAccountId,
          name: "Draft Metadata Update",
          objective: "TRAFFIC",
          dailyBudgetCents: 3000,
          targetSubreddits: ["startups"],
        }),
      }),
    );
    expect(draftRes.status).toBe(201);
    const draftJson = (await readJson(draftRes)) as {
      campaign: { id: string };
    };
    createdCampaignIds.push(draftJson.campaign.id);

    const renameRes = await updateCampaign(
      new Request(
        `http://test.local/api/reddit/ads/campaigns/${draftJson.campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Draft Metadata Update v2" }),
        },
      ),
      { params: { id: draftJson.campaign.id } },
    );
    expect(renameRes.status).toBe(200);
    expect(mockedQueue.enqueueRedditAdsSyncJob).not.toHaveBeenCalled();
  });

  test("active campaign config edits enqueue sync with CONFIG_CHANGE trigger", async () => {
    const draftRes = await createCampaign(
      new Request("http://test.local/api/reddit/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          redditAccountId,
          name: "Active Config Update",
          objective: "TRAFFIC",
          dailyBudgetCents: 3000,
          targetSubreddits: ["startups"],
          headline: "Ad headline",
          body: "Ad body",
          destinationUrl: "https://example.com",
        }),
      }),
    );
    expect(draftRes.status).toBe(201);
    const draftJson = (await readJson(draftRes)) as {
      campaign: { id: string };
    };
    createdCampaignIds.push(draftJson.campaign.id);

    const activateRes = await updateCampaign(
      new Request(
        `http://test.local/api/reddit/ads/campaigns/${draftJson.campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACTIVE" }),
        },
      ),
      { params: { id: draftJson.campaign.id } },
    );
    expect(activateRes.status).toBe(200);

    mockedQueue.enqueueRedditAdsSyncJob.mockClear();

    const updateRes = await updateCampaign(
      new Request(
        `http://test.local/api/reddit/ads/campaigns/${draftJson.campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyBudgetCents: 4500 }),
        },
      ),
      { params: { id: draftJson.campaign.id } },
    );

    expect(updateRes.status).toBe(200);
    expect(mockedQueue.enqueueRedditAdsSyncJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        campaignId: draftJson.campaign.id,
        status: "ACTIVE",
        action: "UPSERT",
        trigger: "CONFIG_CHANGE",
      }),
    );
  });
});
