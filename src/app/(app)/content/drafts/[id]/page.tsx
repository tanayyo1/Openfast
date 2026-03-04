"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DraftEditor } from "@/components/app/editor/DraftEditor";
import {
  parseDraftComplianceSnapshot,
  parseDraftVariants,
} from "@/lib/content/draftVariants";
import {
  RewriteDialog,
  type RewriteOptions,
} from "@/components/app/editor/RewriteDialog";

type DraftStatus = "DRAFT" | "REVIEWING" | "APPROVED" | "REJECTED" | "ARCHIVED";

type DraftDetail = {
  id: string;
  taskId: string | null;
  subredditId: string | null;
  type: "POST" | "COMMENT";
  title: string | null;
  body: string;
  variants: unknown;
  generationParams: unknown;
  status: DraftStatus;
  riskScore: number;
  riskReasons: string[];
};

type TaskDetail = {
  id: string;
  roadmapId: string;
  dayIndex: number;
  type: string;
  subredditId: string | null;
};

function formatTaskType(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function statusLabel(status: DraftStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "REVIEWING":
      return "Needs approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "ARCHIVED":
      return "Archived";
    default:
      return status;
  }
}

export default function DraftPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const draftId = params?.id ? decodeURIComponent(params.id) : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [task, setTask] = useState<TaskDetail | null>(null);

  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteResult, setRewriteResult] = useState<{
    newDraftId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const draftRes = await fetch(
          `/api/drafts/${encodeURIComponent(draftId)}?includeStructure=1`,
          {
            cache: "no-store",
          },
        );
        const draftJson = (await draftRes.json()) as
          | { draft?: DraftDetail; error?: string }
          | undefined;

        if (!draftRes.ok || !draftJson?.draft) {
          throw new Error(draftJson?.error ?? "Draft not found");
        }

        let nextTask: TaskDetail | null = null;
        if (draftJson.draft.taskId) {
          const taskRes = await fetch(
            `/api/tasks/${encodeURIComponent(draftJson.draft.taskId)}`,
            { cache: "no-store" },
          );
          const taskJson = (await taskRes.json()) as
            | { task?: TaskDetail; error?: string }
            | undefined;
          if (taskRes.ok && taskJson?.task) {
            nextTask = taskJson.task;
          }
        }

        if (cancelled) return;
        setDraft(draftJson.draft);
        setTask(nextTask);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load draft";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!draftId) {
      setError("Draft not found");
      setLoading(false);
      return;
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [draftId]);

  const variants = useMemo(() => {
    if (!draft) return [];
    const notes =
      draft.riskReasons.length > 0
        ? draft.riskReasons
        : ["Review for subreddit fit before publishing."];
    const compliance = parseDraftComplianceSnapshot(draft.generationParams);
    const parsed = parseDraftVariants({
      variants: draft.variants,
      fallbackRiskScore: draft.riskScore,
      fallbackNotes: notes,
      compliance,
      selectedTitle: draft.title,
      selectedBody: draft.body,
      selectedRiskScore: draft.riskScore,
    });
    if (parsed.length > 0) {
      return parsed;
    }

    return [
      {
        title: draft.title ?? "",
        body: draft.body,
        riskScore: draft.riskScore,
        notes,
        complianceScore: compliance?.selectedComplianceScore ?? null,
        valueScore: compliance?.selectedValueScore ?? null,
        antiPatternFlags: compliance?.selectedAntiPatternFlags ?? [],
        expectedTone: compliance?.selectedExpectedTone ?? null,
        detectedTone: compliance?.selectedDetectedTone ?? null,
      },
    ];
  }, [draft]);

  async function persistDraft(
    input: { title: string; body: string },
    opts?: { showNotice?: boolean },
  ) {
    if (!draft || saving || acting) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.type === "POST" ? input.title.trim() || null : null,
          body: input.body.trim(),
        }),
      });
      const json = (await res.json()) as
        | {
            draft?: { title: string | null; body: string; status: DraftStatus };
            error?: string;
          }
        | undefined;

      if (!res.ok || !json?.draft) {
        throw new Error(json?.error ?? "Failed to save draft");
      }

      const updatedDraft = json.draft;
      setDraft((current) =>
        current
          ? {
              ...current,
              title: updatedDraft?.title ?? current.title,
              body: updatedDraft?.body ?? current.body,
              status: updatedDraft?.status ?? current.status,
            }
          : current,
      );
      if (opts?.showNotice ?? true) {
        setNotice("Draft saved");
      }
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save draft";
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(input: { title: string; body: string }) {
    await persistDraft(input, { showNotice: true });
  }

  async function requestApproval(input: { title: string; body: string }) {
    if (!draft || saving || acting) return;

    const saved = await persistDraft(input, { showNotice: false });
    if (!saved) return;

    setActing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/drafts/${encodeURIComponent(draft.id)}/request-approval`,
        { method: "POST" },
      );
      const json = (await res.json()) as
        | { draft?: { status: DraftStatus }; error?: string }
        | undefined;

      if (!res.ok || !json?.draft) {
        throw new Error(json?.error ?? "Failed to request approval");
      }

      setDraft((current) =>
        current
          ? { ...current, status: json.draft?.status ?? current.status }
          : current,
      );
      setNotice("Draft saved and sent for approval");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to request approval";
      setError(message);
    } finally {
      setActing(false);
    }
  }

  async function approve() {
    if (!draft || saving || acting) return;
    setActing(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/drafts/${encodeURIComponent(draft.id)}/approve`,
        {
          method: "POST",
        },
      );
      const json = (await res.json()) as
        | { draft?: { status: DraftStatus }; error?: string }
        | undefined;

      if (!res.ok || !json?.draft) {
        throw new Error(json?.error ?? "Failed to approve draft");
      }

      setDraft((current) =>
        current
          ? { ...current, status: json.draft?.status ?? current.status }
          : current,
      );
      setNotice("Draft approved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to approve draft";
      setError(message);
    } finally {
      setActing(false);
    }
  }

  function handleRewriteOpen() {
    setRewriteError(null);
    setRewriteOpen(true);
  }

  async function handleRewriteSubmit(opts: RewriteOptions) {
    if (!draft || rewriteLoading) return;
    setRewriteLoading(true);
    setRewriteError(null);

    try {
      const res = await fetch(
        `/api/drafts/${encodeURIComponent(draft.id)}/rewrite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        },
      );
      const json = (await res.json()) as
        | { draft?: { id: string }; error?: string }
        | undefined;

      if ((res.status !== 202 && !res.ok) || !json?.draft?.id) {
        throw new Error(json?.error ?? "Failed to create rewrite");
      }

      setRewriteResult({ newDraftId: json.draft.id });
      setRewriteOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create rewrite";
      setRewriteError(message);
    } finally {
      setRewriteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Loading draft...</h1>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">
          {error === "Draft not found"
            ? "Draft not found"
            : "Unable to load draft"}
        </h1>
        {error && error !== "Draft not found" ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : null}
        <Link href="/content" className="text-sm underline">
          Back to drafts
        </Link>
      </div>
    );
  }

  const canEdit = draft.status === "DRAFT" || draft.status === "REJECTED";
  const canRequestApproval = canEdit;
  const canApprove = draft.status === "REVIEWING";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Draft
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {task ? formatTaskType(task.type) : draft.type.toLowerCase()} for{" "}
            {task?.subredditId ?? draft.subredditId ?? "general"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Status: {statusLabel(draft.status)}
            {task ? (
              <>
                <span className="mx-2 text-muted-foreground/40">|</span>
                Day {task.dayIndex}
              </>
            ) : null}
            {saving || acting ? (
              <>
                <span className="mx-2 text-muted-foreground/40">|</span>
                Updating...
              </>
            ) : null}
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

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-green-300 bg-green-50 px-5 py-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {notice}
        </div>
      ) : null}

      {rewriteResult ? (
        <div className="rounded-2xl border border-green-300 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
            Rewrite created
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            New variants have been generated.{" "}
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/content/drafts/${encodeURIComponent(rewriteResult.newDraftId)}`,
                )
              }
              className="underline"
            >
              View new draft
            </button>
          </p>
        </div>
      ) : null}

      <DraftEditor
        key={draft.id}
        variants={variants}
        taskType={draft.type === "POST" ? "Post" : "Comment"}
        subreddit={task?.subredditId ?? draft.subredditId ?? "general"}
        initialTitle={draft.title ?? ""}
        initialBody={draft.body}
        onSave={canEdit ? saveDraft : undefined}
        onRequestApproval={canRequestApproval ? requestApproval : undefined}
        onApprove={canApprove ? approve : undefined}
        onRewrite={draft.status !== "ARCHIVED" ? handleRewriteOpen : undefined}
        isBusy={saving || acting || rewriteLoading}
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
