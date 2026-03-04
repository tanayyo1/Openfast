jest.mock("@/lib/server/admin-guards", () => ({
  requirePlatformAdminSession: jest.fn(),
}));

jest.mock("@/lib/prompts/templates", () => ({
  findPromptTemplateById: jest.fn(),
  activatePromptTemplate: jest.fn(),
}));

import { POST as activatePromptTemplateRoute } from "@/app/api/internal/admin/prompt-templates/[id]/activate/route";

const mockedAdminGuards = jest.requireMock("@/lib/server/admin-guards") as {
  requirePlatformAdminSession: jest.Mock;
};
const mockedTemplates = jest.requireMock("@/lib/prompts/templates") as {
  findPromptTemplateById: jest.Mock;
  activatePromptTemplate: jest.Mock;
};

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe("prompt template activate route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAdminGuards.requirePlatformAdminSession.mockResolvedValue({
      user: { id: "admin_1" },
    });
  });

  test("returns 404 when template does not exist before activation", async () => {
    mockedTemplates.findPromptTemplateById.mockResolvedValue(null);

    const res = await activatePromptTemplateRoute(
      new Request(
        "http://test.local/api/internal/admin/prompt-templates/pt_1/activate",
        {
          method: "POST",
        },
      ),
      { params: { id: "pt_1" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROMPT_TEMPLATE_NOT_FOUND");
    expect(mockedTemplates.activatePromptTemplate).not.toHaveBeenCalled();
  });

  test("returns 404 when activation races and target disappears", async () => {
    mockedTemplates.findPromptTemplateById.mockResolvedValue({
      id: "pt_1",
      key: "content.generate",
    });
    mockedTemplates.activatePromptTemplate.mockResolvedValue(null);

    const res = await activatePromptTemplateRoute(
      new Request(
        "http://test.local/api/internal/admin/prompt-templates/pt_1/activate",
        {
          method: "POST",
        },
      ),
      { params: { id: "pt_1" } },
    );

    expect(res.status).toBe(404);
    const json = (await readJson(res)) as { code: string };
    expect(json.code).toBe("PROMPT_TEMPLATE_NOT_FOUND");
  });
});
