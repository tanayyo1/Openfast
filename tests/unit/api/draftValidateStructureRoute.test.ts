jest.mock("@/lib/server/auth-guards", () => ({
  requireWorkspaceSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    draft: {
      findFirst: jest.fn(),
    },
  },
}));

import { POST as validateStructure } from "@/app/api/drafts/[id]/validate-structure/route";

const mockedGuards = jest.requireMock("@/lib/server/auth-guards") as {
  requireWorkspaceSession: jest.Mock;
};
const mockedPrisma = jest.requireMock("@/lib/prisma").prisma as {
  draft: { findFirst: jest.Mock };
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("draft validate-structure route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuards.requireWorkspaceSession.mockResolvedValue({
      user: { id: "u_1" },
      workspaceId: "ws_1",
    });
    mockedPrisma.draft.findFirst.mockResolvedValue({
      id: "dr_1",
      title: "How we improved retention",
      body: "Value-first text before product mention appears later in the post body.",
    });
  });

  test("returns 400 BAD_JSON for malformed JSON", async () => {
    const res = await validateStructure(
      new Request("http://test.local/api/drafts/dr_1/validate-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("BAD_JSON");
  });

  test("returns 400 VALIDATION_ERROR for schema-invalid input", async () => {
    const res = await validateStructure(
      new Request("http://test.local/api/drafts/dr_1/validate-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCategory: "x".repeat(101) }),
      }),
      { params: Promise.resolve({ id: "dr_1" }) },
    );

    expect(res.status).toBe(400);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("VALIDATION_ERROR");
  });
});
