import { classifyRedditResponseError } from "@/lib/reddit/errors";

describe("reddit error classification", () => {
  test("429 maps to rate limit with retry-after", () => {
    const res = new Response("too many", {
      status: 429,
      headers: { "retry-after": "2" },
    });
    const err = classifyRedditResponseError(res);
    expect(err.code).toBe("REDDIT_RATE_LIMIT");
    expect(err.httpStatus).toBe(429);
    expect(err.isRetryable).toBe(true);
    expect(err.retryAfterMs).toBe(2000);
  });

  test("401 maps to auth failed", () => {
    const res = new Response("nope", { status: 401 });
    const err = classifyRedditResponseError(res);
    expect(err.code).toBe("REDDIT_AUTH_FAILED");
    expect(err.isRetryable).toBe(false);
  });

  test("5xx maps to server error and retryable", () => {
    const res = new Response("boom", { status: 503 });
    const err = classifyRedditResponseError(res);
    expect(err.code).toBe("REDDIT_SERVER_ERROR");
    expect(err.isRetryable).toBe(true);
  });
});
