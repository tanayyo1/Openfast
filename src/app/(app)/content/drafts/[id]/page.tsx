"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DraftEditor } from "@/components/app/editor/DraftEditor";
import {
  RewriteDialog,
  type RewriteOptions,
} from "@/components/app/editor/RewriteDialog";
import { useDemoStore } from "@/stores/demoStore";

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const draftId = params?.id ? decodeURIComponent(params.id) : "";

  const draft = useDemoStore((state) =>
    state.drafts.find((d) => d.id === draftId),
  );
  const task = useDemoStore((state) =>
    draft ? state.tasks.find((t) => t.id === draft.taskId) : undefined,
  );

  const selectDraftVariant = useDemoStore((state) => state.selectDraftVariant);
  const saveDraftEdits = useDemoStore((state) => state.saveDraftEdits);
  const requestApproval = useDemoStore((state) => state.requestApproval);
  const approveDraft = useDemoStore((state) => state.approveDraft);

  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteResult, setRewriteResult] = useState<{
    newDraftId: string;
    queueId: string;
  } | null>(null);

  async function handleRewriteSubmit(opts: RewriteOptions) {
    setRewriteLoading(true);
    setRewriteError(null);

    try {
      const res = await fetch(`/api/drafts/${draftId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: opts.mode,
          tone: opts.tone || undefined,
          length: opts.length,
          variantCount: opts.variantCount,
        }),
      });

      if (res.status === 202) {
        const json = (await res.json()) as {
          draft: { id: string };
          queue: { id: string };
        };
        setRewriteResult({
          newDraftId: json.draft.id,
          queueId: json.queue.id,
        });
        setRewriteOpen(false);
      } else {
        const json = (await res.json()) as { error: string };
        setRewriteError(json.error ?? "Rewrite failed");
      }
    } catch {
      setRewriteError("Network error — please try again");
    } finally {
      setRewriteLoading(false);
    }
  }

  if (!draft || !task) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Draft not found</h1>
        <Link href="/content" className="text-sm underline">
          Back to drafts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Draft
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {task.type} for {task.subreddit}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {draft.status}
            <span className="mx-2 text-muted-foreground/40">|</span>
            Best-time window: {task.bestWindow}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/content"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Back
          </Link>
          <Link
            href="/approvals"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Approvals
          </Link>
          <Link
            href="/scheduling/calendar"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
          >
            Scheduling
          </Link>
        </div>
      </div>

      {rewriteResult ? (
        <div className="rounded-2xl border border-green-300 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
            Rewrite queued
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            The worker is generating variants.{" "}
            <Link
              href={`/content/drafts/${rewriteResult.newDraftId}`}
              className="underline"
            >
              View new draft
            </Link>
          </p>
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
            Queue job: {rewriteResult.queueId}
          </p>
        </div>
      ) : null}

      <DraftEditor
        variants={draft.variants}
        initialSelectedIndex={draft.selectedIndex}
        initialTitle={draft.editedTitle}
        initialBody={draft.editedBody}
        onSelectVariant={(index) =>
          selectDraftVariant({ draftId: draft.id, index })
        }
        onSave={({ title, body }) =>
          saveDraftEdits({ draftId: draft.id, title, body })
        }
        onRequestApproval={() => requestApproval({ taskId: task.id })}
        onApprove={
          draft.status === "Needs approval"
            ? () => approveDraft({ taskId: task.id })
            : undefined
        }
        onRewrite={() => setRewriteOpen(true)}
      />

      <RewriteDialog
        open={rewriteOpen}
        onOpenChange={setRewriteOpen}
        onSubmit={handleRewriteSubmit}
        loading={rewriteLoading}
        error={rewriteError}
      />
    </div>
  );
}
