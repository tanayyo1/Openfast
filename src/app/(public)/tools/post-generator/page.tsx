"use client";

import { FormEvent, useState } from "react";
import { MaxWidth } from "@/components/public/MaxWidth";

type PostGenerateResponse = {
  draft: { title: string | null; body: string };
  variants: Array<{ title: string | null; body: string }>;
  risk: { riskScore: number; riskReasons: string[] };
  policyHints: {
    promoAllowed?: boolean;
    linkPolicy?: string;
    flairRequired?: boolean;
    textOnly?: boolean;
  } | null;
  subredditRulesPreview?: string[];
};

export default function PostGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("founders");
  const [tone, setTone] = useState("helpful");
  const [subreddit, setSubreddit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PostGenerateResponse | null>(null);

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
              Draft Reddit posts with structure hints, tone control, and
              compliance cues.
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
            <p className="text-sm font-semibold">Drafts</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Preview three variants before you export into the main app.
            </p>
            <div className="mt-6 space-y-4">
              {(result?.variants.length ? result.variants : [1, 2, 3]).map(
                (item, index) => (
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
                ),
              )}
              {result?.policyHints ? (
                <div className="rounded-2xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Policy hints</p>
                  <p className="mt-2">
                    Link policy: {result.policyHints.linkPolicy ?? "unknown"} |
                    Flair required:{" "}
                    {result.policyHints.flairRequired ? "yes" : "no"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
