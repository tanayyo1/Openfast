"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DraftEditor } from "@/components/app/editor/DraftEditor";
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
      />
    </div>
  );
}
