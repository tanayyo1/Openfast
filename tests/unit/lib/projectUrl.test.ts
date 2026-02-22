import { normalizeProjectUrlInput } from "@/lib/projects/url";

describe("normalizeProjectUrlInput", () => {
  test("returns null for empty/invalid inputs", () => {
    expect(normalizeProjectUrlInput("")).toBeNull();
    expect(normalizeProjectUrlInput("   ")).toBeNull();
    expect(normalizeProjectUrlInput("not a url%%%%")).toBeNull();
    expect(normalizeProjectUrlInput("notaurl")).toBeNull();
    expect(normalizeProjectUrlInput("http://internal-service")).toBeNull();
    expect(normalizeProjectUrlInput("https://example..com")).toBeNull();
    expect(normalizeProjectUrlInput("https://...")).toBeNull();
    expect(
      normalizeProjectUrlInput("https://user:pass@example.com"),
    ).toBeNull();
    expect(normalizeProjectUrlInput("http://999.999.999.999")).toBeNull();
    expect(normalizeProjectUrlInput("http://256.1.1.1")).toBeNull();
    expect(normalizeProjectUrlInput("http://1.2.3.999")).toBeNull();
    expect(normalizeProjectUrlInput("https://1.2.3")).toBeNull();
    expect(normalizeProjectUrlInput("http://010.000.000.001")).toBeNull();
    expect(normalizeProjectUrlInput("http://0177.0.0.1")).toBeNull();
    expect(normalizeProjectUrlInput("http://2130706433")).toBeNull();
    expect(normalizeProjectUrlInput("http://0x7f000001")).toBeNull();
    expect(normalizeProjectUrlInput("ftp://example.com")).toBeNull();
    expect(normalizeProjectUrlInput(null)).toBeNull();
  });

  test("preserves valid http(s) URLs", () => {
    expect(normalizeProjectUrlInput("https://example.com")).toBe(
      "https://example.com/",
    );
    expect(normalizeProjectUrlInput("HtTp://example.com")).toBe(
      "http://example.com/",
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

  test("allows localhost and IP URLs for local development", () => {
    expect(normalizeProjectUrlInput("http://localhost:3000")).toBe(
      "http://localhost:3000/",
    );
    expect(normalizeProjectUrlInput("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/",
    );
    expect(normalizeProjectUrlInput("http://[::1]:3000/docs")).toBe(
      "http://[::1]:3000/docs",
    );
  });
});
