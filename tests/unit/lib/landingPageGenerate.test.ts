import { generateChatText } from "@/lib/ai/openaiClient";
import { generateLandingPage } from "@/lib/landingPages/generate";

jest.mock("@/lib/ai/openaiClient", () => ({
  generateChatText: jest.fn(),
}));

const mockedGenerateChatText = generateChatText as jest.MockedFunction<
  typeof generateChatText
>;

describe("landing page generator", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    mockedGenerateChatText.mockReset();
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  test("returns deterministic fallback when OpenAI key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const page = await generateLandingPage({
      projectName: "SignalLoop",
      projectDescription: "Analytics for growth teams",
      projectNiche: "saas analytics",
      primaryKeyword: "saas analytics landing page",
      audience: "B2B SaaS teams",
      tone: "clear",
      offer: "Weekly analytics review",
      ctaText: "Book demo",
    });

    expect(page.source).toBe("fallback");
    expect(page.slug).toContain("saas-analytics-landing-page");
    expect(page.sections.faqs.length).toBeGreaterThanOrEqual(3);
  });

  test("uses OpenAI payload when valid json is returned", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockedGenerateChatText.mockResolvedValue(
      JSON.stringify({
        headline: "Scale your Reddit pipeline with confidence",
        subheadline:
          "A practical framework that helps teams build demand through repeatable community workflows.",
        valueProps: [
          "Signal quality framework",
          "Execution checklists",
          "Conversion tracking",
        ],
        painPoints: [
          "Hard to prioritize experiments",
          "Inconsistent messaging",
          "No feedback loop",
        ],
        featureBullets: [
          "Planning board",
          "Draft copilot",
          "Analytics snapshots",
        ],
        socialProof: ["Used by growth teams", "Built for practical execution"],
        faqs: [
          {
            question: "Who is it for?",
            answer: "Growth teams running Reddit as a channel.",
          },
          {
            question: "How fast to launch?",
            answer: "First version can ship in days.",
          },
          {
            question: "What is included?",
            answer: "Workflow templates, copy prompts, and reporting loops.",
          },
        ],
        finalCta: "Start free",
        metaTitle: "Reddit Pipeline | SignalLoop",
        metaDescription:
          "Build repeatable Reddit growth loops with practical execution.",
      }),
    );

    const page = await generateLandingPage({
      projectName: "SignalLoop",
      projectDescription: "Analytics for growth teams",
      projectNiche: "saas analytics",
      primaryKeyword: "reddit demand gen",
      audience: "B2B SaaS teams",
      tone: "practical",
      offer: "Weekly analytics review",
      ctaText: "Book demo",
    });

    expect(page.source).toBe("openai");
    expect(page.headline).toContain("Reddit");
    expect(page.sections.featureBullets).toContain("Planning board");
    expect(page.sections.finalCta).toBe("Start free");
  });
});
