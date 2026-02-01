export type RedditErrorCode =
  | "REDDIT_RATE_LIMIT"
  | "REDDIT_AUTH_FAILED"
  | "REDDIT_FORBIDDEN"
  | "REDDIT_NOT_FOUND"
  | "REDDIT_BAD_REQUEST"
  | "REDDIT_SERVER_ERROR"
  | "REDDIT_UNKNOWN_ERROR"
  | "REDIS_NOT_CONFIGURED";

export class RedditApiError extends Error {
  readonly code: RedditErrorCode;
  readonly httpStatus: number;
  readonly isRetryable: boolean;
  readonly retryAfterMs?: number;

  constructor(opts: {
    code: RedditErrorCode;
    message: string;
    httpStatus: number;
    isRetryable: boolean;
    retryAfterMs?: number;
  }) {
    super(opts.message);
    this.name = "RedditApiError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.isRetryable = opts.isRetryable;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

function parseRetryAfterMs(h: string | null): number | undefined {
  if (!h) return undefined;
  const seconds = Number(h);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.floor(seconds * 1000);
}

export function classifyRedditResponseError(res: Response): RedditApiError {
  const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));

  if (res.status === 429) {
    return new RedditApiError({
      code: "REDDIT_RATE_LIMIT",
      message: "Reddit rate limit exceeded",
      httpStatus: 429,
      isRetryable: true,
      retryAfterMs,
    });
  }

  if (res.status === 401) {
    return new RedditApiError({
      code: "REDDIT_AUTH_FAILED",
      message: "Reddit auth failed",
      httpStatus: 401,
      isRetryable: false,
    });
  }

  if (res.status === 403) {
    return new RedditApiError({
      code: "REDDIT_FORBIDDEN",
      message: "Reddit request forbidden",
      httpStatus: 403,
      isRetryable: false,
    });
  }

  if (res.status === 404) {
    return new RedditApiError({
      code: "REDDIT_NOT_FOUND",
      message: "Reddit resource not found",
      httpStatus: 404,
      isRetryable: false,
    });
  }

  if (res.status >= 400 && res.status < 500) {
    return new RedditApiError({
      code: "REDDIT_BAD_REQUEST",
      message: "Reddit request failed",
      httpStatus: res.status,
      isRetryable: false,
    });
  }

  if (res.status >= 500) {
    return new RedditApiError({
      code: "REDDIT_SERVER_ERROR",
      message: "Reddit server error",
      httpStatus: res.status,
      isRetryable: true,
      retryAfterMs,
    });
  }

  return new RedditApiError({
    code: "REDDIT_UNKNOWN_ERROR",
    message: "Reddit request failed",
    httpStatus: res.status,
    isRetryable: false,
    retryAfterMs,
  });
}
