import { normalizeProjectUrlInput } from "@/lib/projects/url";

describe("normalizeProjectUrlInput", () => {
  test("returns null for empty/invalid inputs", () => {
    expect(normalizeProjectUrlInput("")).toBeNull();
    expect(normalizeProjectUrlInput("   ")).toBeNull();
    expect(normalizeProjectUrlInput("not a url%%%%")).toBeNull();
    expect(normalizeProjectUrlInput(null)).toBeNull();
  });

  test("preserves valid http(s) URLs", () => {
    expect(normalizeProjectUrlInput("https://example.com")).toBe(
      "https://example.com/",
    );
    expect(normalizeProjectUrlInput("http://example.com/pricing")).toBe(
      "http://example.com/pricing",
    );
  });

  test("adds https:// when protocol is missing", () => {
    expect(normalizeProjectUrlInput("example.com")).toBe(
      "https://example.com/",
    );
    expect(normalizeProjectUrlInput("example.com/docs")).toBe(
      "https://example.com/docs",
    );
  });
});
