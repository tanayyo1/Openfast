import {
  buildProjectPrefillFromPostGenerator,
  clearPostGeneratorHandoff,
  consumePostGeneratorHandoff,
  readPostGeneratorHandoff,
  savePostGeneratorHandoff,
} from "@/lib/publicToolHandoff";

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    hasKey: (key: string) => store.has(key),
    setRaw: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("public tool handoff", () => {
  test("reads handoff payload without clearing and consume clears it", () => {
    const storage = createStorageMock();

    const saved = savePostGeneratorHandoff(
      {
        topic: " onboarding loop ",
        product: " Openfast ",
        audience: " founders ",
        tone: " helpful ",
        goal: "feedback",
        subreddit: "r/startups",
        draftTitle: "Draft 1",
        draftBody: "  Body copy  ",
        source: "openai",
      },
      storage,
    );

    expect(saved).toBe(true);
    const read = readPostGeneratorHandoff(storage);
    expect(read).toEqual(
      expect.objectContaining({
        topic: "onboarding loop",
        product: "Openfast",
        audience: "founders",
        tone: "helpful",
        goal: "feedback",
        source: "openai",
      }),
    );
    expect(storage.hasKey("rf_post_generator_handoff_v1")).toBe(true);

    const consumed = consumePostGeneratorHandoff(storage);
    expect(consumed).toEqual(
      expect.objectContaining({
        topic: "onboarding loop",
      }),
    );
    expect(storage.hasKey("rf_post_generator_handoff_v1")).toBe(false);
  });

  test("returns null for malformed payloads and clears storage", () => {
    const storage = createStorageMock();
    storage.setRaw(
      "rf_post_generator_handoff_v1",
      JSON.stringify({
        topic: "ok",
        product: "ok",
        audience: "ok",
        tone: "ok",
        goal: "invalid-goal",
      }),
    );

    const read = readPostGeneratorHandoff(storage);
    expect(read).toBeNull();
    expect(storage.hasKey("rf_post_generator_handoff_v1")).toBe(false);
  });

  test("clear helper removes stored handoff", () => {
    const storage = createStorageMock();
    storage.setRaw(
      "rf_post_generator_handoff_v1",
      JSON.stringify({
        topic: "topic",
        product: "product",
        audience: "audience",
        tone: "helpful",
        goal: "feedback",
        draftBody: "body",
      }),
    );

    clearPostGeneratorHandoff(storage);
    expect(storage.hasKey("rf_post_generator_handoff_v1")).toBe(false);
  });

  test("builds onboarding project prefill from handoff context", () => {
    const prefill = buildProjectPrefillFromPostGenerator({
      topic: "reddit onboarding strategy",
      product: "Openfast",
      audience: "founders",
      tone: "data-driven",
      goal: "launch",
      subreddit: "r/startups",
      draftTitle: "Launch angle",
      draftBody:
        "Sharing what we shipped, why it matters, and where we still need feedback.",
      source: "fallback",
      createdAt: "2026-02-23T00:00:00.000Z",
    });

    expect(prefill.name).toBe("Openfast");
    expect(prefill.description).toContain("helps founders");
    expect(prefill.description).toContain("reddit onboarding strategy");
    expect(prefill.primaryGoal).toBe("Leads");
    expect(prefill.brandVoice).toContain("Data-driven");
  });
});
