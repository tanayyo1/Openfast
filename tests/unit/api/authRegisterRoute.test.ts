jest.mock("@/lib/password", () => ({
  hashPassword: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { POST as register } from "@/app/api/auth/register/route";
import { hashPassword } from "@/lib/password";

const mockedHashPassword = hashPassword as jest.Mock;
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("auth register route", () => {
  const tx = {
    user: { create: jest.fn() },
    workspace: { create: jest.fn() },
    workspaceMember: { create: jest.fn() },
    workspaceEntitlement: { create: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHashPassword.mockResolvedValue("hashed_pw");
    mockedPrisma.$transaction.mockImplementation(async (fn: Function) => fn(tx));
    tx.user.create.mockResolvedValue({
      id: "u_1",
      email: "user@example.com",
      name: "User",
    });
    tx.workspace.create.mockResolvedValue({ id: "ws_1", name: "My workspace" });
    tx.workspaceMember.create.mockResolvedValue({ id: "wm_1" });
    tx.workspaceEntitlement.create.mockResolvedValue({ id: "ent_1" });
  });

  test("normalizes email to lowercase for lookup and create", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const res = await register(
      new Request("http://test.local/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "  User@Example.COM ",
          password: "password123",
          name: "User",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "user@example.com" } }),
    );
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "user@example.com" }),
      }),
    );
  });

  test("returns 409 when normalized email already exists", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "u_existing" });

    const res = await register(
      new Request("http://test.local/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "User@Example.COM",
          password: "password123",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("EMAIL_TAKEN");
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  test("returns 409 on concurrent unique violation during create", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.$transaction.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["email"] },
    });

    const res = await register(
      new Request("http://test.local/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "User@Example.COM",
          password: "password123",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("EMAIL_TAKEN");
  });
});
