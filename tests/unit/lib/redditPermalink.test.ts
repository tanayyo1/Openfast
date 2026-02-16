import { normalizeRedditPermalink } from "@/lib/reddit/permalink";

describe("normalizeRedditPermalink", () => {
  it("accepts relative reddit permalinks", () => {
    expect(normalizeRedditPermalink("/r/test/comments/abc123/post")).toBe(
      "https://www.reddit.com/r/test/comments/abc123/post",
    );
  });

  it("accepts reddit absolute URLs and normalizes host", () => {
    expect(
      normalizeRedditPermalink("https://old.reddit.com/r/test/comments/abc123"),
    ).toBe("https://www.reddit.com/r/test/comments/abc123");
  });

  it("rejects non-reddit hosts", () => {
    expect(normalizeRedditPermalink("https://example.com/r/test")).toBeNull();
  });

  it("rejects invalid URL input", () => {
    expect(normalizeRedditPermalink("not-a-url")).toBeNull();
  });
});
