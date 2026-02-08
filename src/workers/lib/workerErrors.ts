type WorkerError = {
  code: string;
  message: string;
  isRetryable: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function permanentWorkerError(
  code: string,
  message: string,
): WorkerError {
  return { code, message, isRetryable: false };
}

export function retryableWorkerError(
  code: string,
  message: string,
): WorkerError {
  return { code, message, isRetryable: true };
}

export function normalizeWorkerError(
  err: unknown,
  fallbackCode: string,
): WorkerError {
  if (isObject(err) && typeof err.code === "string") {
    return {
      code: err.code,
      message:
        typeof err.message === "string" && err.message.length > 0
          ? err.message
          : "Worker failed",
      isRetryable:
        typeof err.isRetryable === "boolean" ? err.isRetryable : false,
    };
  }

  if (err instanceof Error) {
    return {
      code: fallbackCode,
      message: err.message || "Worker failed",
      isRetryable: false,
    };
  }

  return { code: fallbackCode, message: "Worker failed", isRetryable: false };
}

export function toJobFailure(err: WorkerError): Error {
  const e = new Error(`${err.code}: ${err.message}`);
  (e as Error & { code?: string; isRetryable?: boolean }).code = err.code;
  (e as Error & { code?: string; isRetryable?: boolean }).isRetryable =
    err.isRetryable;
  return e;
}

export function toStoredError(err: WorkerError): string {
  return JSON.stringify({
    code: err.code,
    message: err.message,
    retryable: err.isRetryable,
    at: new Date().toISOString(),
  });
}
