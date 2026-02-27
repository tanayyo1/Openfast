"use client";

import { useEffect, useMemo, useState } from "react";
import { MobilePreviewCard } from "./MobilePreviewCard";
import { PostStructurePanel } from "./PostStructurePanel";

type Variant = {
  title: string;
  body: string;
  riskScore: number;
  notes: string[];
};

type DraftEditorProps = {
  variants: Variant[];
  taskType?: "Post" | "Comment";
  subreddit?: string;
  initialSelectedIndex?: number;
  initialTitle?: string;
  initialBody?: string;
  onSelectVariant?: (index: number) => void;
  onSave?: (input: { title: string; body: string }) => void;
  onRequestApproval?: (input: { title: string; body: string }) => void;
  onApprove?: () => void;
  onRewrite?: () => void;
  isBusy?: boolean;
};

const FALLBACK_VARIANT: Variant = {
  title: "",
  body: "",
  riskScore: 0,
  notes: ["No generated variants yet. Add or rewrite content to continue."],
};

function clampVariantIndex(index: number, totalVariants: number) {
  if (totalVariants <= 0) return 0;
  return Math.min(Math.max(index, 0), totalVariants - 1);
}

export function DraftEditor({
  variants,
  taskType = "Post",
  subreddit = "r/subreddit",
  initialSelectedIndex = 0,
  initialTitle,
  initialBody,
  onSelectVariant,
  onSave,
  onRequestApproval,
  onApprove,
  onRewrite,
  isBusy = false,
}: DraftEditorProps) {
  const safeInitialIndex = clampVariantIndex(
    initialSelectedIndex,
    variants.length,
  );
  const [selectedIndex, setSelectedIndex] = useState(safeInitialIndex);

  useEffect(() => {
    setSelectedIndex((current) => clampVariantIndex(current, variants.length));
  }, [variants.length]);

  const selected =
    variants[selectedIndex] ?? variants[safeInitialIndex] ?? FALLBACK_VARIANT;

  const [title, setTitle] = useState(initialTitle ?? selected.title);
  const [body, setBody] = useState(initialBody ?? selected.body);

  const riskTone = useMemo(() => {
    if (selected.riskScore <= 30) return "Low";
    if (selected.riskScore <= 60) return "Medium";
    return "High";
  }, [selected.riskScore]);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[24px] border border-border bg-card/80 p-6">
        <p className="text-sm font-semibold">Variants</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a starting point. Edit before approval and scheduling.
        </p>
        {variants.length > 0 ? (
          <div className="mt-5 space-y-3">
            {variants.map((variant, index) => (
              <button
                key={`variant-${index}`}
                type="button"
                onClick={() => {
                  setSelectedIndex(index);
                  setTitle(variant.title);
                  setBody(variant.body);
                  onSelectVariant?.(index);
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  index === selectedIndex
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background/70 hover:border-foreground/40"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Variant {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold">{variant.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Risk score: {variant.riskScore} (
                  {variant.riskScore <= 30
                    ? "Low"
                    : variant.riskScore <= 60
                      ? "Medium"
                      : "High"}
                  )
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            No generated variants yet. You can still edit manually and save.
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Compliance notes
          </p>
          <p className="mt-2 text-sm font-semibold">Risk: {riskTone}</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {selected.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <PostStructurePanel title={title} body={body} />
        </div>
      </div>

      <div className="rounded-[24px] border border-border bg-background/70 p-6">
        <p className="text-sm font-semibold">Editor</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Request approval will save your latest edits before sending.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="title" className="text-sm font-semibold">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="body" className="text-sm font-semibold">
              Body
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={12}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {onSave ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onSave({ title, body })}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                Save draft
              </button>
            ) : null}
            {onRequestApproval ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onRequestApproval({ title, body })}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Request approval
              </button>
            ) : null}
            {onApprove ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onApprove()}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Approve
              </button>
            ) : null}
            {onRewrite ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onRewrite()}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Rewrite
              </button>
            ) : null}
          </div>

          <MobilePreviewCard
            taskType={taskType}
            subreddit={subreddit}
            title={title}
            body={body}
          />
        </div>
      </div>
    </div>
  );
}
