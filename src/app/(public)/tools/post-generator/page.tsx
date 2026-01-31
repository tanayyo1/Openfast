import { MaxWidth } from "@/components/public/MaxWidth";

export default function PostGeneratorPage() {
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
            <div className="mt-8 rounded-[24px] border border-border bg-card/80 p-6">
              <p className="text-sm font-semibold">Input</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold" htmlFor="product">
                    Product or topic
                  </label>
                  <input
                    id="product"
                    type="text"
                    placeholder="Describe your product or idea"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="audience">
                    Target subreddit audience
                  </label>
                  <input
                    id="audience"
                    type="text"
                    placeholder="Founders, indie makers, or marketers"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="tone">
                    Tone
                  </label>
                  <select
                    id="tone"
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  >
                    <option>Curious and helpful</option>
                    <option>Founder story</option>
                    <option>Data-driven</option>
                    <option>Question-led</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Generate drafts
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-border bg-background/70 p-6">
            <p className="text-sm font-semibold">Drafts</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Preview three variants before you export into the main app.
            </p>
            <div className="mt-6 space-y-4">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-border bg-card/80 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Draft {index}
                  </p>
                  <p className="mt-3 text-sm font-semibold">
                    Title placeholder for your Reddit post
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Body preview will appear here. It should include context,
                    value, and a clear discussion prompt.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      Low promo
                    </span>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      Question ending
                    </span>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      Rule-safe
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MaxWidth>
    </div>
  );
}
