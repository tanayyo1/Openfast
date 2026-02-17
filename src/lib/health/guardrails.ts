function parsePositiveEnvInt(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

export function getHealthGuardrailThresholds() {
  const blockPublishing = parsePositiveEnvInt("HEALTH_BLOCK_THRESHOLD", 30);
  const cautionRaw = parsePositiveEnvInt("HEALTH_CAUTION_THRESHOLD", 45);
  const caution =
    cautionRaw <= blockPublishing ? blockPublishing + 1 : cautionRaw;

  return {
    blockPublishing,
    caution,
  };
}
