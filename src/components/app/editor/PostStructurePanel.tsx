"use client";

import { useCallback, useMemo, useState } from "react";
import {
  validatePostStructure,
  type PostStructureResult,
  type RewriteSuggestion,
  type StructureGrade,
} from "@/lib/content/postStructureValidator";

const STRUCTURE_DOC_PATH = "/docs/post-structure";

type PostStructurePanelProps = {
  title: string;
  body: string;
  subredditStrict?: boolean;
  productCategory?: string;
  /** When provided (e.g. from GET /api/drafts/:id?includeStructure=1), used instead of client-side validation. */
  structureFromApi?: PostStructureResult | null;
};

const gradeColors: Record<StructureGrade, string> = {
  A: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40",
  B: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40",
  C: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40",
  D: "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40",
  F: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40",
};

function useCopyToClipboard() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copy = useCallback((index: number, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }, []);
  return { copy, copiedIndex };
}

function RewriteSuggestionsWithCopy({ list }: { list: RewriteSuggestion[] }) {
  const { copy, copiedIndex } = useCopyToClipboard();
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted-foreground">
        Rewrite suggestions
      </p>
      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
        {list.map((s, i) => {
          const text = `${s.issue}: ${s.suggestion}`;
          return (
            <li key={i} className="flex items-start justify-between gap-2">
              <span>
                <span className="font-medium text-foreground">{s.issue}:</span>{" "}
                {s.suggestion}
              </span>
              <button
                type="button"
                onClick={() => copy(i, text)}
                className="shrink-0 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                {copiedIndex === i ? "Copied" : "Copy"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PostStructurePanel({
  title,
  body,
  subredditStrict,
  productCategory,
  structureFromApi,
}: PostStructurePanelProps) {
  const clientResult = useMemo<PostStructureResult | null>(() => {
    if (structureFromApi !== undefined) return null;
    if (!body.trim()) return null;
    return validatePostStructure(title || null, body, {
      subredditStrict,
      productCategory,
    });
  }, [title, body, subredditStrict, productCategory, structureFromApi]);

  const result = structureFromApi ?? clientResult;

  if (!result) {
    return (
      <div className="rounded-2xl border border-border bg-background/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Post structure (RED-63)
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {structureFromApi === null
            ? "Structure could not be loaded."
            : "Add body text to see structure score and conversion tips."}
        </p>
        <a
          href={STRUCTURE_DOC_PATH}
          className="mt-2 inline-block text-xs font-medium text-primary underline"
        >
          View structure guide
        </a>
      </div>
    );
  }

  const gradeClass = gradeColors[result.grade];
  const hasErrors = result.warnings.some((w) => w.severity === "error");

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Post structure (conversion)
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${gradeClass}`}
        >
          Grade {result.grade}
        </span>
        <span className="text-sm text-muted-foreground">
          Score {result.score}/100
        </span>
        {hasErrors && (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            Fix before posting for best results
          </span>
        )}
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">
            Warnings
          </p>
          <ul className="mt-2 space-y-1.5">
            {result.warnings.map((w) => (
              <li
                key={w.code}
                className={`flex items-start gap-2 text-sm ${
                  w.severity === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                <span
                  className={
                    w.severity === "error"
                      ? "inline-flex shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-semibold"
                      : undefined
                  }
                >
                  {w.severity === "error" ? "Error" : "Warning"}
                </span>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.rewriteSuggestions.length > 0 && (
        <RewriteSuggestionsWithCopy list={result.rewriteSuggestions} />
      )}

      {result.abTestSuggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">
            A/B headline ideas
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {result.abTestSuggestions.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{s.angle}:</span>{" "}
                {s.exampleHeadline}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.complementaryProductSuggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">
            Strict subreddits
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {result.complementaryProductSuggestions.map((s, i) => (
              <li key={i}>
                {s.tool} — {s.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.goodBadExamples && (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          <p className="font-semibold text-muted-foreground">Structure guide</p>
          <p className="mt-1.5 text-muted-foreground">
            {result.goodBadExamples.good}
          </p>
          <p className="mt-1 text-muted-foreground">
            {result.goodBadExamples.bad}
          </p>
          <a
            href={STRUCTURE_DOC_PATH}
            className="mt-2 inline-block font-medium text-primary underline"
          >
            View full doc
          </a>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {result.headlineAnalysis.feedback} {result.valueSection.feedback}{" "}
        {result.productMention.feedback} {result.linkPlacement.feedback}
      </p>
    </div>
  );
}
