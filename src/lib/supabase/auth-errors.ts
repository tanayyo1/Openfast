function asMessage(err: unknown) {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message ?? "";
  if (typeof err === "object" && "message" in err) {
    const value = (err as { message?: unknown }).message;
    if (typeof value === "string") return value;
  }
  return "";
}

export function toFriendlyAuthError(err: unknown) {
  const message = asMessage(err).trim();
  const normalized = message.toLowerCase();

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network request failed") ||
    normalized.includes("typeerror: fetch") ||
    normalized.includes("enotfound") ||
    normalized.includes("eai_again")
  ) {
    return "Unable to reach Supabase Auth. Verify NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and local network/DNS.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("email already registered")
  ) {
    return "This email is already registered. Please sign in instead.";
  }

  if (normalized.includes("email rate limit")) {
    return "Too many signup attempts. Please wait and try again.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Email is not confirmed yet. Please check your inbox.";
  }

  if (message.length > 0) return message;
  return "Authentication failed. Please try again.";
}
