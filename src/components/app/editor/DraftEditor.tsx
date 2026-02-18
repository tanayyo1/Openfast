"use client";

import { useMemo, useState } from "react";
import { PostStructurePanel } from "./PostStructurePanel";

type Variant = {
  title: string;
  body: string;
  riskScore: number;
  notes: string[];
};

type DraftEditorProps = {
  variants: Variant[];
  initialSelectedIndex?: number;
  initialTitle?: string;
  initialBody?: string;
  onSelectVariant?: (index: number) => void;
  onSave?: (input: { title: string; body: string }) => void;
  onRequestApproval?: () => void;
  onApprove?: () => void;
  onRewrite?: () => void;
};

export function DraftEditor({
  variants,
  initialSelectedIndex = 0,
  initialTitle,
  initialBody,
  onSelectVariant,
  onSave,
  onRequestApproval,
  onApprove,
  onRewrite,
}: DraftEditorProps) {
  const initial = variants[0];
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const selected = variants[selectedIndex] ?? initial;

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
        <div className="mt-5 space-y-3">
          {variants.map((variant, index) => (
            <button
              key={variant.title}
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
          Save edits, then request approval before scheduling.
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
            <button
              type="button"
              onClick={() => onSave?.({ title, body })}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => onRequestApproval?.()}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
            >
              Request approval
            </button>
            {onApprove ? (
              <button
                type="button"
                onClick={() => onApprove()}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
              >
                Approve
              </button>
            ) : null}
            {onRewrite ? (
              <button
                type="button"
                onClick={() => onRewrite()}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold"
              >
                Rewrite
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
