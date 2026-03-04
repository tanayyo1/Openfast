import {
  firstValidationErrorMessage,
  mapOnboardingAuthError,
  readResponseJson,
  withHttpStatusFallback,
} from "@/lib/onboarding/clientResponses";

describe("onboarding client responses", () => {
  test("readResponseJson returns parsed JSON", async () => {
    const parsed = await readResponseJson<{ ok: boolean }>({
      json: async () => ({ ok: true }),
    });
    expect(parsed).toEqual({ ok: true });
  });

  test("readResponseJson returns null for malformed JSON", async () => {
    const parsed = await readResponseJson({
      json: async () => {
        throw new Error("bad-json");
      },
    });
    expect(parsed).toBeNull();
  });

  test("firstValidationErrorMessage prefers field errors", () => {
    const message = firstValidationErrorMessage({
      fieldErrors: {
        name: ["", "Name is required"],
      },
      formErrors: ["Try again later"],
    });
    expect(message).toBe("Name is required");
  });

  test("firstValidationErrorMessage falls back to form errors", () => {
    const message = firstValidationErrorMessage({
      formErrors: ["", "Description is required"],
    });
    expect(message).toBe("Description is required");
  });

  test("withHttpStatusFallback appends status when message is missing", () => {
    expect(
      withHttpStatusFallback("", 503, "Failed to load OAuth status."),
    ).toBe("Failed to load OAuth status. (HTTP 503).");
  });

  test("withHttpStatusFallback keeps non-empty message", () => {
    expect(
      withHttpStatusFallback("Session expired", 401, "Fallback message"),
    ).toBe("Session expired");
  });

  test("mapOnboardingAuthError returns mapped messages", () => {
    expect(mapOnboardingAuthError("WORKSPACE_REQUIRED")).toBe(
      "Workspace session is missing. Reload onboarding and try again.",
    );
    expect(mapOnboardingAuthError("UNAUTHORIZED")).toBe(
      "Your session expired. Sign in again and retry.",
    );
  });

  test("mapOnboardingAuthError falls back for unknown codes", () => {
    expect(mapOnboardingAuthError("UNKNOWN_CODE", "Fallback")).toBe("Fallback");
  });
});
