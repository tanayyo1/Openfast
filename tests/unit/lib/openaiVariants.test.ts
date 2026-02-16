jest.mock("@/lib/ai/openaiClient", () => ({
  generateChatText: jest.fn(),
}));

jest.mock("@/lib/prompts/templates", () => ({
  PROMPT_KEYS: {
    CONTENT_GENERATE: "content.generate",
    CONTENT_REWRITE: "content.rewrite",
    CONTENT_COMPLIANCE: "content.compliance",
  },
  fallbackPromptBodyForKey: jest.fn(() => "fallback prompt"),
  findActivePromptTemplateByKey: jest.fn(),
  renderPromptTemplate: jest.fn((body: string) => body),
}));

import { generateChatText } from "@/lib/ai/openaiClient";
import { generateDraftVariantsWithOpenAI } from "@/lib/content/openaiVariants";
import { findActivePromptTemplateByKey } from "@/lib/prompts/templates";

const mockedOpenAI = generateChatText as jest.Mock;
const mockedFindTemplate = findActivePromptTemplateByKey as jest.Mock;
const originalOpenAIKey = process.env.OPENAI_API_KEY;

describe("openai variants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.OPENAI_API_KEY = "test-openai-key";
    mockedFindTemplate.mockResolvedValue({
      key: "content.generate",
      body: "template body",
    });
  });

  afterAll(() => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    if (originalOpenAIKey === undefined) {
      delete mutableEnv.OPENAI_API_KEY;
    } else {
      mutableEnv.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  test("returns parsed variants when LLM returns valid JSON", async () => {
    mockedOpenAI.mockResolvedValue(
      JSON.stringify({
        variants: [
          { title: "A", body: "Body A", score: 0.9 },
          { title: "B", body: "Body B", score: 0.8 },
        ],
      }),
    );

    const out = await generateDraftVariantsWithOpenAI({
      mode: "GENERATE",
      projectName: "ReditFast",
      subredditName: "startups",
      subredditRulesText: "No spam",
      taskTitle: "Task",
      taskInstructions: "Give value",
      baseTitle: "Base",
      baseBody: "Base body",
      variantCount: 3,
      preferredLength: "medium",
    });

    expect(out).not.toBeNull();
    expect(out?.variants.length).toBe(2);
    expect(out?.primary.title).toBe("A");
  });

  test("returns null when LLM output is not parseable JSON", async () => {
    mockedOpenAI.mockResolvedValue("not-json");

    const out = await generateDraftVariantsWithOpenAI({
      mode: "GENERATE",
      projectName: "ReditFast",
      subredditName: "startups",
      subredditRulesText: null,
      taskTitle: "Task",
      taskInstructions: "Give value",
      baseTitle: "Base",
      baseBody: "Base body",
      variantCount: 3,
      preferredLength: "medium",
    });

    expect(out).toBeNull();
  });
});
