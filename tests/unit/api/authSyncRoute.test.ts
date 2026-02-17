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
              email: "Member@Reditfast.local ",
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
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "member@reditfast.local" },
        select: expect.objectContaining({
          id: true,
          authId: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        }),
      }),
    );
  });

  test("returns 400 when authenticated profile has no email", async () => {
    mockedCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "auth_no_email",
              email: null,
              email_confirmed_at: null,
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
    });

    const res = await syncUser(
      new Request("http://test.local/api/auth/sync", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("EMAIL_REQUIRED");
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("creates user/workspace with safe field selection only", async () => {
    mockedCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: "auth_new_1",
              email: "new@reditfast.local",
              email_confirmed_at: null,
              user_metadata: { name: "New User" },
            },
          },
          error: null,
        }),
      },
    });
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockResolvedValue({
      id: "u_new",
      authId: "auth_new_1",
      email: "new@reditfast.local",
      name: "New User",
      image: null,
      emailVerified: null,
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z",
    });
    mockedPrisma.workspace.create.mockResolvedValue({
      id: "ws_new",
      name: "New User's Workspace",
      ownerId: "u_new",
      plan: "FREE",
      status: "ACTIVE",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z",
    });

    const res = await syncUser(
      new Request("http://test.local/api/auth/sync", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(201);
    expect(mockedPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          authId: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        }),
      }),
    );
    expect(mockedPrisma.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          name: true,
          ownerId: true,
          plan: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        }),
      }),
    );
  });
});
