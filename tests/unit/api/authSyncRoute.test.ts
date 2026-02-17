jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
    },
  },
}));

import { POST as syncUser } from "@/app/api/auth/sync/route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = createClient as jest.Mock;
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  workspaceMember: { findFirst: jest.Mock };
  workspace: { create: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("auth sync route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns existing membership workspace when user is not workspace owner", async () => {
    mockedCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "auth_1",
              email: "member@reditfast.local",
              email_confirmed_at: "2026-02-16T00:00:00.000Z",
              user_metadata: { name: "Member User" },
            },
          },
          error: null,
        }),
      },
    });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "u_member",
      authId: "auth_1",
      email: "member@reditfast.local",
      name: "Member User",
    });
    mockedPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspace: { id: "ws_team", name: "Team Workspace" },
    });

    const res = await syncUser(new Request("http://test.local/api/auth/sync", {
      method: "POST",
    }));

    expect(res.status).toBe(200);
    const json = (await readJson(res)) as {
      workspace: { id: string };
    };
    expect(json.workspace.id).toBe("ws_team");
    expect(mockedPrisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u_member" },
        orderBy: { createdAt: "asc" },
      }),
    );
  });
});
