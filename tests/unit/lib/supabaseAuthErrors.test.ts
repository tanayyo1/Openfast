import { toFriendlyAuthError } from "@/lib/supabase/auth-errors";

describe("toFriendlyAuthError", () => {
  test("maps network/fetch failures to actionable message", () => {
    expect(toFriendlyAuthError(new Error("Failed to fetch"))).toContain(
      "Unable to reach Supabase Auth",
    );
    expect(toFriendlyAuthError("TypeError: fetch failed")).toContain(
      "Unable to reach Supabase Auth",
    );
    expect(
      toFriendlyAuthError(new Error("getaddrinfo ENOTFOUND abc.supabase.co")),
    ).toContain("Unable to reach Supabase Auth");
  });

  test("maps invalid credentials to concise message", () => {
    expect(toFriendlyAuthError({ message: "Invalid login credentials" })).toBe(
      "Invalid email or password.",
    );
  });

  test("maps already-registered signup errors", () => {
    expect(toFriendlyAuthError(new Error("User already registered"))).toBe(
      "This email is already registered. Please sign in instead.",
    );
  });

  test("falls back to raw message when no mapping exists", () => {
    expect(toFriendlyAuthError(new Error("custom auth error"))).toBe(
      "custom auth error",
    );
  });
});
