import { useDemoStore } from "@/stores/demoStore";

describe("demoStore rewriteDraft", () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo();
  });

  test("persists rewrite mode/tone/length and applies them to generated variants", () => {
    const projectId = useDemoStore.getState().createProject({
      name: "Test project",
      description: "Project used for rewrite flow tests.",
      brandVoice: "neutral",
      goals: ["acquisition"],
    });

    useDemoStore.getState().generateRoadmap({ projectId });
    const taskId = useDemoStore.getState().tasks[0]?.id;
    expect(taskId).toBeTruthy();
    if (!taskId) return;

    const sourceDraftId = useDemoStore
      .getState()
      .generateDraftForTask({ taskId });

    const rewrittenId = useDemoStore.getState().rewriteDraft({
      draftId: sourceDraftId,
      mode: "COMPLIANCE",
      tone: "  empathetic  ",
      length: "short",
      variantCount: 4,
    });

    const rewritten = useDemoStore
      .getState()
      .drafts.find((draft) => draft.id === rewrittenId);

    expect(rewritten).toBeDefined();
    expect(rewritten?.generationParams).toEqual({
      mode: "COMPLIANCE",
      tone: "empathetic",
      length: "short",
      variantCount: 4,
      sourceDraftId,
    });
    expect(rewritten?.variants).toHaveLength(4);
    expect(rewritten?.editedBody).toContain("Tone: empathetic.");
    expect(rewritten?.editedBody.length ?? 0).toBeLessThanOrEqual(220);
    expect(rewritten?.variants[0]?.notes).toEqual(
      expect.arrayContaining([
        "Mode: COMPLIANCE",
        "Tone: empathetic",
        "Length: short",
      ]),
    );
  });
});
