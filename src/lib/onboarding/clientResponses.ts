type ValidationFieldErrors = Record<string, string[] | undefined>;

export type ValidationErrorDetails = {
  fieldErrors?: ValidationFieldErrors;
  formErrors?: string[];
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function readResponseJson<T>(
  res: Pick<Response, "json">,
): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function firstValidationErrorMessage(
  details?: ValidationErrorDetails | null,
): string | null {
  if (!details) return null;

  const fieldErrors = details.fieldErrors
    ? Object.values(details.fieldErrors).flatMap((messages) => messages ?? [])
    : [];
  for (const message of fieldErrors) {
    const normalized = nonEmptyString(message);
    if (normalized) return normalized;
  }

  for (const message of details.formErrors ?? []) {
    const normalized = nonEmptyString(message);
    if (normalized) return normalized;
  }

  return null;
}

export function withHttpStatusFallback(
  message: string | null | undefined,
  status: number,
  fallback: string,
) {
  const normalized = nonEmptyString(message);
  return normalized ?? `${fallback} (HTTP ${status}).`;
}

export function mapOnboardingAuthError(code?: string, fallback?: string) {
  if (code === "SUPABASE_NOT_CONFIGURED") {
    return "Auth is not configured. Set Supabase env vars, then retry.";
  }
  if (code === "UNAUTHORIZED") {
    return "Your session expired. Sign in again and retry.";
  }
  if (code === "WORKSPACE_REQUIRED") {
    return "Workspace session is missing. Reload onboarding and try again.";
  }
  if (code === "USER_NOT_SYNCED") {
    return "We couldn't load your account data. Sign out and sign back in, then try again.";
  }
  return fallback ?? "Request failed.";
}
