"use client";

import { useMemo, useState } from "react";

type ProjectOption = {
  id: string;
  name: string;
  niche: string;
};

type LandingPageSections = {
  valueProps: string[];
  painPoints: string[];
  featureBullets: string[];
  socialProof: string[];
  faqs: Array<{ question: string; answer: string }>;
  finalCta: string;
};

type LandingPageDraftView = {
  id: string;
  projectId: string;
  name: string;
  primaryKeyword: string;
  slug: string;
  audience: string;
  tone: string;
  ctaText: string;
  headline: string;
  subheadline: string;
  sections: unknown;
  metaTitle: string | null;
  metaDescription: string | null;
  source: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
  };
};

type LandingPageDraftUi = Omit<LandingPageDraftView, "sections"> & {
  sections: LandingPageSections;
};

type Props = {
  projects: ProjectOption[];
  initialDrafts: LandingPageDraftView[];
};

function asSections(input: unknown): LandingPageSections {
  const fallback: LandingPageSections = {
    valueProps: [],
    painPoints: [],
    featureBullets: [],
    socialProof: [],
    faqs: [],
    finalCta: "",
  };
  if (!input || typeof input !== "object") return fallback;

  const raw = input as Partial<LandingPageSections>;
  const asStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
      : [];

  return {
    valueProps: asStringArray(raw.valueProps),
    painPoints: asStringArray(raw.painPoints),
    featureBullets: asStringArray(raw.featureBullets),
    socialProof: asStringArray(raw.socialProof),
    faqs: Array.isArray(raw.faqs)
      ? raw.faqs.filter(
          (item): item is { question: string; answer: string } =>
            !!item &&
            typeof item === "object" &&
            typeof (item as { question?: unknown }).question === "string" &&
            typeof (item as { answer?: unknown }).answer === "string",
        )
      : [],
    finalCta: typeof raw.finalCta === "string" ? raw.finalCta : "",
  };
}

function toInputDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function LandingPageManager({ projects, initialDrafts }: Props) {
  const hasProjects = projects.length > 0;
  const [drafts, setDrafts] = useState<LandingPageDraftUi[]>(() =>
    initialDrafts.map((draft) => ({
      ...draft,
      sections: asSections(draft.sections),
    })),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    primaryKeyword: "",
    audience: "",
    tone: "clear and practical",
    offer: "",
    ctaText: "Get started",
  });

  const counts = useMemo(
    () => ({
      total: drafts.length,
      openai: drafts.filter((item) => item.source === "openai").length,
      fallback: drafts.filter((item) => item.source !== "openai").length,
    }),
    [drafts],
  );

  async function generateDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!hasProjects || !form.projectId) {
      setError("Create a project first before generating landing pages.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${form.projectId}/landing-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryKeyword: form.primaryKeyword,
          audience: form.audience || undefined,
          tone: form.tone || undefined,
          offer: form.offer || undefined,
          ctaText: form.ctaText || undefined,
        }),
      });
      const json = (await res.json()) as {
        draft?: LandingPageDraftView;
        error?: string;
      };
      if (!res.ok || !json.draft) {
        setError(json.error ?? "Failed to generate landing page");
        return;
      }
      setDrafts((prev) => [
        {
          ...json.draft!,
          sections: asSections(json.draft?.sections),
        },
        ...prev,
      ]);
      setForm((prev) => ({
        ...prev,
        primaryKeyword: "",
        audience: "",
        offer: "",
      }));
    } catch {
      setError("Request failed while generating landing page");
    } finally {
      setIsGenerating(false);
    }
  }

  async function archiveDraft(draft: LandingPageDraftUi) {
    setLoadingId(draft.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${draft.projectId}/landing-pages/${draft.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        },
      );
      const json = (await res.json()) as {
        draft?: LandingPageDraftView;
        error?: string;
      };
      if (!res.ok || !json.draft) {
        setError(json.error ?? "Failed to archive landing page");
        return;
      }
      setDrafts((prev) => prev.filter((item) => item.id !== draft.id));
    } catch {
      setError("Request failed while archiving landing page");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Drafts</p>
          <p className="mt-1 text-2xl font-semibold">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">OpenAI</p>
          <p className="mt-1 text-2xl font-semibold">{counts.openai}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="text-xs text-muted-foreground">Fallback</p>
          <p className="mt-1 text-2xl font-semibold">{counts.fallback}</p>
        </div>
      </div>

      <form
        onSubmit={generateDraft}
        className="rounded-[24px] border border-border bg-card/80 p-6"
      >
        <p className="text-sm font-semibold">Generate landing page draft</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            value={form.projectId}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, projectId: e.target.value }))
            }
            disabled={!hasProjects}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            required
          >
            {!hasProjects ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
          <input
            value={form.primaryKeyword}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, primaryKeyword: e.target.value }))
            }
            placeholder="Primary keyword (e.g. reddit growth strategy)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            required
          />
          <input
            value={form.audience}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, audience: e.target.value }))
            }
            placeholder="Audience (optional)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.tone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tone: e.target.value }))
            }
            placeholder="Tone"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.offer}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, offer: e.target.value }))
            }
            placeholder="Offer (optional)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={form.ctaText}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, ctaText: e.target.value }))
            }
            placeholder="CTA text"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
        </div>
        {error ? (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!hasProjects || isGenerating}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {!hasProjects
            ? "Create a project first"
            : isGenerating
              ? "Generating..."
              : "Generate landing page"}
        </button>
      </form>

      <div className="grid gap-4">
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
            No landing page drafts yet.
          </div>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-[24px] border border-border bg-card/80 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{draft.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {draft.project.name} • {draft.primaryKeyword} •{" "}
                    {draft.source}
                  </p>
                  <p className="mt-2 text-sm">{draft.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {draft.subheadline}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingId === draft.id}
                  onClick={() => archiveDraft(draft)}
                  className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Archive
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Value Props
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {draft.sections.valueProps.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Pain Points
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {draft.sections.painPoints.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  CTA
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {draft.sections.finalCta || draft.ctaText}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Slug: /seo/guides/{draft.slug} • Updated{" "}
                  {toInputDate(draft.updatedAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
