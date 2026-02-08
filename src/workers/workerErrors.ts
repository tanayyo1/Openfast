import { UnrecoverableError } from "bullmq";

export type WorkerFailure = {
  code: string;
  message: string;
  isRetryable: boolean;
};

export function retryableWorkerError(
  code: string,
  message: string,
): WorkerFailure {
  return { code, message, isRetryable: true };
}

export function permanentWorkerError(
  code: string,
  message: string,
): WorkerFailure {
  return { code, message, isRetryable: false };
}

export function normalizeWorkerError(
  err: unknown,
  fallbackCode: string,
): WorkerFailure {
  if (isWorkerFailure(err)) return err;
  if (err instanceof UnrecoverableError) {
    return permanentWorkerError(fallbackCode, err.message);
  }
  if (err instanceof Error) {
    return retryableWorkerError(fallbackCode, err.message);
  }
  return retryableWorkerError(fallbackCode, "Unknown worker error");
}

export function toStoredError(err: WorkerFailure) {
  return err.code;
}

export function toJobFailure(err: WorkerFailure): Error {
  if (err.isRetryable) return new Error(`${err.code}:${err.message}`);
  return new UnrecoverableError(`${err.code}:${err.message}`);
}

function isWorkerFailure(value: unknown): value is WorkerFailure {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      "message" in value &&
      "isRetryable" in value,
  );
}
