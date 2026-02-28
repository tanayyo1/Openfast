"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";

type ChecklistItem = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warning";
  message?: string;
  details?: string;
};

type ProjectStats = {
  totalRoadmaps: number;
  completedRoadmaps: number;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  completionPercentage: number;
};

type ValidationResponse = {
  projectId: string;
  valid: boolean;
  checklist: ChecklistItem[];
  warnings: string[];
  errors: string[];
  stats: ProjectStats;
};

interface PreCloseChecklistProps {
  projectId: string;
  onClose?: (force: boolean) => void;
  showActions?: boolean;
}

export function PreCloseChecklist({
  projectId,
  onClose,
  showActions = true,
}: PreCloseChecklistProps) {
  const [data, setData] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchValidation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/validate-close`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch validation");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleClose = async (force: boolean) => {
    if (!data) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED", force }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to close project");
      }
      onClose?.(force);
      await fetchValidation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <p className="font-medium">Error loading checklist</p>
        </div>
        <p className="mt-2 text-sm text-destructive/80">{error}</p>
        <button
          onClick={fetchValidation}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const passCount = data.checklist.filter((i) => i.status === "pass").length;
  const failCount = data.checklist.filter((i) => i.status === "fail").length;
  const warningCount = data.checklist.filter(
    (i) => i.status === "warning",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pre-Close Checklist</h3>
          <p className="text-sm text-muted-foreground">
            Complete these items before archiving the project
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            {passCount}
          </span>
          {failCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-4 w-4" />
              {failCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {warningCount}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {data.checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              item.status === "pass"
                ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
                : item.status === "fail"
                  ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20"
                  : "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20"
            }`}
          >
            {item.status === "pass" && (
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
            )}
            {item.status === "fail" && (
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            )}
            {item.status === "warning" && (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
            )}
            <div className="flex-1">
              <p className="font-medium">{item.label}</p>
              {item.message && (
                <p className="text-sm text-muted-foreground">{item.message}</p>
              )}
              {item.details && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.stats.totalTasks > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Completion Progress</span>
            <span className="text-sm font-semibold">
              {data.stats.completionPercentage}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${data.stats.completionPercentage}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{data.stats.completedTasks} completed</span>
            <span>{data.stats.skippedTasks} skipped</span>
            <span>{data.stats.pendingTasks} pending</span>
            {data.stats.blockedTasks > 0 && (
              <span className="text-red-600">
                {data.stats.blockedTasks} blocked
              </span>
            )}
          </div>
        </div>
      )}

      {data.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="font-medium text-red-600">
            Cannot archive project until issues are resolved
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-red-600/80">
            {data.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {data.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="font-medium text-yellow-600">Warnings</p>
          <ul className="mt-2 list-inside list-disc text-sm text-yellow-600/80">
            {data.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {showActions && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleClose(false)}
            disabled={closing || !data.valid}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {closing && <Loader2 className="h-4 w-4 animate-spin" />}
            Archive Project
          </button>
          {!data.valid && (
            <button
              onClick={() => handleClose(true)}
              disabled={closing}
              className="flex items-center gap-2 rounded-lg border border-destructive px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {closing && <Loader2 className="h-4 w-4 animate-spin" />}
              Force Archive
            </button>
          )}
          <button
            onClick={fetchValidation}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:border-foreground/40"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
