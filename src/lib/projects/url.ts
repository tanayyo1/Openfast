function isIpv4Address(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

function isCanonicalIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith("0")) return false;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });
}

function isIpv6Address(hostname: string) {
  const normalized = hostname.replace(/^\[/, "").replace(/\]$/, "");
  return normalized.includes(":") && /^[0-9a-fA-F:.]+$/.test(normalized);
}

function isDomainName(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized.length > 253) return false;
  if (normalized.startsWith(".") || normalized.endsWith(".")) return false;

  const labels = normalized.split(".");
  // Reject single-label hosts (including bare TLDs) to avoid accepting
  // non-actionable project URLs like "notaurl" or "internal-service".
  if (labels.length < 2) return false;

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      !label.startsWith("-") &&
      !label.endsWith("-") &&
      /^[a-z0-9-]+$/.test(label),
  );
}

function extractRawHostname(input: string) {
  const withoutScheme = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const authority = withoutScheme.split(/[/?#]/, 1)[0] ?? "";
  if (!authority) return null;

  const hostWithPort = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;

  if (hostWithPort.startsWith("[")) {
    const closing = hostWithPort.indexOf("]");
    if (closing === -1) return null;
    return hostWithPort.slice(1, closing);
  }

  return hostWithPort.split(":")[0] ?? null;
}

function isAllowedHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  const looksLikeIpv4 = /^\d+(?:\.\d+){3}$/.test(normalized);
  if (looksLikeIpv4 && !isIpv4Address(normalized)) {
    return false;
  }
  return (
    normalized === "localhost" ||
    isIpv4Address(normalized) ||
    isIpv6Address(normalized) ||
    isDomainName(normalized)
  );
}

export function normalizeProjectUrlInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const rawHostname = extractRawHostname(withProtocol);

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  const parsedHostname = parsed.hostname.toLowerCase();
  if (isIpv4Address(parsedHostname)) {
    // The URL parser accepts shorthand/legacy numeric host forms (e.g. 127.1,
    // 2130706433, 0x7f000001) and rewrites them to dotted-decimal IPv4.
    // Only allow canonical dotted-decimal input to avoid ambiguous hosts.
    if (!rawHostname || !isCanonicalIpv4(rawHostname)) {
      return null;
    }
  }
  if (
    rawHostname &&
    /^[0-9.]+$/.test(rawHostname) &&
    !isCanonicalIpv4(rawHostname)
  ) {
    return null;
  }
  if (!isAllowedHostname(parsedHostname)) return null;
  if (parsed.username || parsed.password) return null;
  return parsed.toString();
}
