"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";
import { savePostGeneratorHandoff } from "@/lib/publicToolHandoff";

const INPUT_STORAGE_KEY = "rf_post_generator_inputs_v2";

type PostGoal = "awareness" | "feedback" | "launch" | "case-study";

type PostGenerateResponse = {
  source: "openai" | "fallback";
  draft: { title: string | null; body: string };
  variants: Array<{ title: string | null; body: string }>;
  risk: {
    riskScore: number;
    riskReasons: string[];
    suggestedFixes: Array<{ issue: string; fix: string }>;
  };
  policyHints: {
    promoAllowed?: boolean;
    linkPolicy?: string;
    flairRequired?: boolean;
    textOnly?: boolean;
  } | null;
  subredditRulesPreview?: string[];
};

type DraftVariantPreview = { title: string | null; body: string };

export default function PostGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("founders");
  const [tone, setTone] = useState("helpful");
  const [goal, setGoal] = useState<PostGoal>("feedback");
  const [subreddit, setSubreddit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [result, setResult] = useState<PostGenerateResponse | null>(null);
  const bestDraft = result?.variants[0] ?? result?.draft ?? null;
  const draftCards: Array<DraftVariantPreview | number> = result
    ? result.variants.length > 0
      ? result.variants
      : [result.draft]
    : [1, 2, 3];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INPUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        topic?: string;
        product?: string;
        audience?: string;
        tone?: string;
        goal?: PostGoal;
        subreddit?: string;
      };
      if (typeof parsed.topic === "string") setTopic(parsed.topic);
      if (typeof parsed.product === "string") setProduct(parsed.product);
      if (typeof parsed.audience === "string") setAudience(parsed.audience);
      if (typeof parsed.tone === "string") setTone(parsed.tone);
      if (
        parsed.goal === "awareness" ||
        parsed.goal === "feedback" ||
        parsed.goal === "launch" ||
        parsed.goal === "case-study"
      ) {
        setGoal(parsed.goal);
      }
      if (typeof parsed.subreddit === "string") setSubreddit(parsed.subreddit);
    } catch {
      // Keep page usable even when local storage has invalid data.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        INPUT_STORAGE_KEY,
        JSON.stringify({ topic, product, audience, tone, goal, subreddit }),
      );
    } catch {
      // Ignore storage failures in constrained browser modes.
    }
  }, [topic, product, audience, tone, goal, subreddit]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!topic.trim() || !product.trim()) {
      setError("Topic and product are required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/tools/post-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          product: product.trim(),
          audience: audience.trim() || "founders",
          tone: tone.trim() || "helpful",
          goal,
          subreddit: subreddit.trim() || undefined,
        }),
      });

      const json = (await res.json()) as
        | PostGenerateResponse
        | { error?: string; code?: string };

      if (!res.ok) {
        const apiError =
          typeof json === "object" && json && "error" in json
            ? json.error
            : "Failed to generate drafts.";
        setError(apiError ?? "Failed to generate drafts.");
        return;
      }

      setResult(json as PostGenerateResponse);
    } catch {
      setError("Network error while generating drafts. Please retry.");
    } finally {
      setIsLoading(false);
    }
  }

  function startOnboardingFromDraft(selectedDraft: DraftVariantPreview) {
    if (!result) return;
    setHandoffError(null);
    const draftBody = selectedDraft.body.trim();
    if (draftBody.length === 0) {
      setHandoffError(
        "Selected draft body is empty. Generate again and choose a draft with content.",
      );
      return;
    }

    const persisted = savePostGeneratorHandoff({
      topic: topic.trim(),
      product: product.trim(),
      audience: audience.trim() || "founders",
      tone: tone.trim() || "helpful",
      goal,
      subreddit: subreddit.trim() || null,
      draftTitle: selectedDraft.title ?? null,
      draftBody,
      source: result.source,
    });

    if (!persisted) {
      setHandoffError(
        "Unable to carry this draft into onboarding. Please retry in a normal browser tab.",
      );
      return;
    }

    window.location.assign("/onboarding/create-project?source=post-generator");
  }

  return (
    <div className="pb-20 pt-16">
      <MaxWidth>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Free tool
            </p>
            <h1 className="mt-4 text-4xl font-semibold">
              Reddit post generator
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Draft safer Reddit posts with structure hints, tone control, and
              compliance cues before you publish anything.
            </p>
            <form
              className="mt-8 rounded-[24px] border border-border bg-card/80 p-6"
              onSubmit={onSubmit}
            >
              <p className="text-sm font-semibold">Input</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold" htmlFor="topic">
                    Topic
                  </label>
                  <input
                    id="topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="What should this Reddit post discuss?"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="product">
                    Product
                  </label>
                  <input
                    id="product"
                    type="text"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Openfast"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="audience">
                    Target audience
                  </label>
                  <input
                    id="audience"
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="Founders, indie makers, or marketers"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="goal">
                    Post goal
                  </label>
                  <select
                    id="goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value as PostGoal)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option value="feedback">Get feedback</option>
                    <option value="awareness">Build awareness</option>
                    <option value="launch">Launch update</option>
                    <option value="case-study">Mini case study</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="subreddit">
                    Subreddit (optional)
                  </label>
                  <input
                    id="subreddit"
                    type="text"
                    value={subreddit}
                    onChange={(e) => setSubreddit(e.target.value)}
                    placeholder="r/test"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="tone">
                    Tone
                  </label>
                  <select
                    id="tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option value="helpful">Curious and helpful</option>
                    <option value="founder-story">Founder story</option>
                    <option value="data-driven">Data-driven</option>
                    <option value="question-led">Question-led</option>
                  </select>
                </div>
                {error ? (
                  <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                >
                  {isLoading ? "Generating..." : "Generate drafts"}
                </button>
              </div>
            </form>
          </div>
          <div className="rounded-[28px] border border-border bg-background/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Drafts</p>
              <div className="flex flex-wrap items-center gap-2">
                {result ? (
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    Source: {result.source === "openai" ? "OpenAI" : "Fallback"}
                  </span>
                ) : null}
                {bestDraft ? (
                  <button
                    type="button"
                    onClick={() => startOnboardingFromDraft(bestDraft)}
                    className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                  >
                    Use best draft in app
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Preview three variants before you export into the main app.
            </p>
            {handoffError ? (
              <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {handoffError}
              </p>
            ) : null}
            {result?.source === "fallback" ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                AI generation was unavailable, so you are seeing deterministic
                fallback drafts.
              </p>
            ) : null}
            <div className="mt-6 space-y-4">
              {draftCards.map((item, index) => (
                <div
                  key={
                    typeof item === "number" ? item : `${item.title}-${index}`
                  }
                  className="rounded-2xl border border-border bg-card/80 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Draft {index + 1}
                  </p>
                  <p className="mt-3 text-sm font-semibold">
                    {typeof item === "number"
                      ? "Title placeholder for your Reddit post"
                      : (item.title ?? "Untitled draft")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {typeof item === "number"
                      ? "Body preview will appear here. It should include context, value, and a clear discussion prompt."
                      : item.body}
                  </p>
                  {typeof item === "number" ? null : (
                    <button
                      type="button"
                      onClick={() => startOnboardingFromDraft(item)}
                      className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-foreground/40"
                    >
                      Use this draft in app
                    </button>
                  )}
                  {result ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        Risk {result.risk.riskScore}
                      </span>
                      {(result.risk.riskReasons || [])
                        .slice(0, 2)
                        .map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                          >
                            {reason}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {result && result.risk.suggestedFixes.length > 0 ? (
                <div className="rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Quick compliance fixes
                  </p>
                  <ul className="mt-2 space-y-2">
                    {result.risk.suggestedFixes.slice(0, 3).map((item) => (
                      <li key={`${item.issue}-${item.fix}`}>
                        <span className="font-semibold text-foreground">
                          {item.issue}:
                        </span>{" "}
                        {item.fix}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result?.policyHints ? (
                <div className="rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Policy hints</p>
                  <p className="mt-2">
                    Link policy: {result.policyHints.linkPolicy ?? "unknown"} |
                    Flair required:{" "}
                    {result.policyHints.flairRequired ? "yes" : "no"}
                  </p>
                  {result.subredditRulesPreview &&
                  result.subredditRulesPreview.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {result.subredditRulesPreview.map((rule) => (
                        <li key={rule}>• {rule}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-10 rounded-[24px] border border-border bg-card/80 p-6">
          <p className="text-sm font-semibold">What to do after this tool</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run this inside the full workflow so drafts are reviewed, approved,
            and scheduled with pacing safeguards.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Start free account
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              View plans
            </Link>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
