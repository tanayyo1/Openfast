"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type RewriteMode = "REWRITE" | "COMPLIANCE";
type RewriteLength = "short" | "medium" | "long";
type VariantCount = 3 | 4 | 5;

export type RewriteOptions = {
  mode: RewriteMode;
  tone: string;
  length: RewriteLength;
  variantCount: VariantCount;
};

type RewriteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (opts: RewriteOptions) => void;
  loading: boolean;
  error: string | null;
};

const modeOptions: { value: RewriteMode; label: string; desc: string }[] = [
  {
    value: "REWRITE",
    label: "Rewrite",
    desc: "Improve clarity and subreddit fit",
  },
  {
    value: "COMPLIANCE",
    label: "Compliance",
    desc: "Reduce promotional risk for strict subreddits",
  },
];

const lengthOptions: RewriteLength[] = ["short", "medium", "long"];
const variantOptions: VariantCount[] = [3, 4, 5];

function ToggleGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  renderLabel,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  renderLabel?: (v: T) => string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 flex gap-2">
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              opt === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {renderLabel ? renderLabel(opt) : String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RewriteDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  error,
}: RewriteDialogProps) {
  const [mode, setMode] = useState<RewriteMode>("REWRITE");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<RewriteLength>("medium");
  const [variantCount, setVariantCount] = useState<VariantCount>(3);

  function handleSubmit() {
    onSubmit({ mode, tone, length, variantCount });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Rewrite draft</DialogTitle>
        <DialogDescription>
          Configure how the draft should be rewritten.
        </DialogDescription>

        <div className="mt-5 space-y-5">
          {/* Mode selector */}
          <div>
            <p className="text-sm font-semibold">Mode</p>
            <div className="mt-2 flex gap-2">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={`flex-1 rounded-2xl border px-3 py-3 text-left transition ${
                    opt.value === mode
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Tone input */}
          <div>
            <label htmlFor="rewrite-tone" className="text-sm font-semibold">
              Tone{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              id="rewrite-tone"
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              maxLength={80}
              placeholder="e.g. professional, casual, empathetic"
              className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
            />
          </div>

          {/* Length selector */}
          <ToggleGroup
            options={lengthOptions}
            value={length}
            onChange={setLength}
            label="Length"
          />

          {/* Variant count */}
          <ToggleGroup
            options={variantOptions}
            value={variantCount}
            onChange={setVariantCount}
            label="Variants"
          />

          {/* Error banner */}
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            >
              {error}
            </div>
          ) : null}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Rewriting\u2026" : "Rewrite draft"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
