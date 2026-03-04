export type DraftComplianceSnapshot = {
  selectedComplianceScore: number | null;
  selectedValueScore: number | null;
  selectedAntiPatternFlags: string[];
  selectedExpectedTone: string | null;
  selectedDetectedTone: string | null;
};

export type DraftVariantView = {
  title: string;
  body: string;
  riskScore: number;
  notes: string[];
  complianceScore: number | null;
  valueScore: number | null;
  antiPatternFlags: string[];
  expectedTone: string | null;
  detectedTone: string | null;
};

function normalizeNumber(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function resolveRiskScore(input: {
  legacyScore: unknown;
  explicitRiskScore: unknown;
  fallbackRiskScore: number;
}) {
  const explicit = normalizeNumber(input.explicitRiskScore, 0, 100);
  if (explicit !== null) return explicit;

  if (
    typeof input.legacyScore === "number" &&
    Number.isFinite(input.legacyScore)
  ) {
    if (input.legacyScore >= 0 && input.legacyScore <= 1) {
      return Math.round((1 - input.legacyScore) * 100);
    }
    if (input.legacyScore >= 0 && input.legacyScore <= 100) {
      return Math.round(input.legacyScore);
    }
  }

  return Math.round(Math.max(0, Math.min(100, input.fallbackRiskScore)));
}

export function parseDraftComplianceSnapshot(
  generationParams: unknown,
): DraftComplianceSnapshot | null {
  if (!generationParams || typeof generationParams !== "object") {
    return null;
  }

  const compliance = (generationParams as { compliance?: unknown }).compliance;
  if (!compliance || typeof compliance !== "object") {
    return null;
  }

  const c = compliance as Record<string, unknown>;

  return {
    selectedComplianceScore: normalizeNumber(c.selectedComplianceScore, 0, 100),
    selectedValueScore: normalizeNumber(c.selectedValueScore, 0, 100),
    selectedAntiPatternFlags: normalizeStringArray(c.selectedAntiPatternFlags),
    selectedExpectedTone: normalizeString(c.selectedExpectedTone),
    selectedDetectedTone: normalizeString(c.selectedDetectedTone),
  };
}

export function parseDraftVariants(input: {
  variants: unknown;
  fallbackRiskScore: number;
  fallbackNotes: string[];
  compliance: DraftComplianceSnapshot | null;
  selectedTitle?: string | null;
  selectedBody?: string | null;
  selectedRiskScore?: number | null;
}): DraftVariantView[] {
  if (!Array.isArray(input.variants)) {
    return [];
  }

  const list: Array<
    Omit<
      DraftVariantView,
      | "valueScore"
      | "complianceScore"
      | "antiPatternFlags"
      | "expectedTone"
      | "detectedTone"
    > & {
      valueScore: number | null;
      complianceScore: number | null;
      antiPatternFlags: string[];
      expectedTone: string | null;
      detectedTone: string | null;
      hasAntiPatternFlagsField: boolean;
    }
  > = [];

  for (const [index, item] of input.variants.entries()) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.body !== "string") continue;

    const riskReasons = normalizeStringArray(candidate.riskReasons);
    const legacyNotes = normalizeStringArray(candidate.notes);
    const antiPatternFlags = normalizeStringArray(candidate.antiPatternFlags);
    const hasAntiPatternFlagsField = Object.prototype.hasOwnProperty.call(
      candidate,
      "antiPatternFlags",
    );

    const valueScore = normalizeNumber(candidate.valueScore, 0, 100);
    const complianceScore = normalizeNumber(candidate.complianceScore, 0, 100);
    const riskScore = resolveRiskScore({
      legacyScore: candidate.score,
      explicitRiskScore: candidate.riskScore,
      fallbackRiskScore: input.fallbackRiskScore,
    });

    list.push({
      title: typeof candidate.title === "string" ? candidate.title : "",
      body: candidate.body,
      riskScore,
      notes:
        riskReasons.length > 0
          ? riskReasons
          : legacyNotes.length > 0
            ? legacyNotes
            : input.fallbackNotes,
      valueScore,
      complianceScore,
      antiPatternFlags,
      expectedTone: normalizeString(candidate.expectedTone),
      detectedTone: normalizeString(candidate.detectedTone),
      hasAntiPatternFlagsField,
    });
  }

  const selectedRiskScore =
    typeof input.selectedRiskScore === "number"
      ? Math.round(Math.max(0, Math.min(100, input.selectedRiskScore)))
      : null;
  const selectedTitle = (input.selectedTitle ?? "").trim();
  const selectedBody = (input.selectedBody ?? "").trim();

  const selectedByContent =
    selectedBody.length > 0
      ? list.findIndex(
          (item) =>
            item.body.trim() === selectedBody &&
            item.title.trim() === selectedTitle,
        )
      : -1;

  const selectedByRisk =
    selectedByContent === -1 && selectedRiskScore !== null
      ? list.findIndex((item) => item.riskScore === selectedRiskScore)
      : -1;

  const selectedIndex =
    selectedByContent !== -1
      ? selectedByContent
      : selectedByRisk !== -1
        ? selectedByRisk
        : -1;

  return list.map((item, index) => {
    const isSelected = index === selectedIndex;
    return {
      title: item.title,
      body: item.body,
      riskScore: item.riskScore,
      notes: item.notes,
      valueScore:
        item.valueScore ??
        (isSelected ? (input.compliance?.selectedValueScore ?? null) : null),
      complianceScore:
        item.complianceScore ??
        (isSelected
          ? (input.compliance?.selectedComplianceScore ?? null)
          : null),
      antiPatternFlags: item.hasAntiPatternFlagsField
        ? item.antiPatternFlags
        : isSelected
          ? (input.compliance?.selectedAntiPatternFlags ?? [])
          : [],
      expectedTone:
        item.expectedTone ??
        (isSelected ? (input.compliance?.selectedExpectedTone ?? null) : null),
      detectedTone:
        item.detectedTone ??
        (isSelected ? (input.compliance?.selectedDetectedTone ?? null) : null),
    };
  });
}
