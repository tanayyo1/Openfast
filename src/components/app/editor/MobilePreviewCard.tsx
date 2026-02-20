"use client";

type MobilePreviewCardProps = {
  taskType: "Post" | "Comment";
  subreddit: string;
  title: string;
  body: string;
};

function normalizeSubreddit(subreddit: string) {
  if (!subreddit.trim()) return "r/subreddit";
  if (subreddit.trim().toLowerCase().startsWith("r/")) return subreddit.trim();
  return `r/${subreddit.trim()}`;
}

export function MobilePreviewCard({
  taskType,
  subreddit,
  title,
  body,
}: MobilePreviewCardProps) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const subredditLabel = normalizeSubreddit(subreddit);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card/80 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Mobile preview
        </p>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          Reddit app
        </span>
      </div>

      <div className="mx-auto mt-4 w-full max-w-[320px] rounded-[28px] border border-border bg-background p-3 shadow-sm">
        <div className="rounded-[22px] border border-border bg-card/80 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{subredditLabel}</span>
            <span>now</span>
          </div>

          {taskType === "Comment" ? (
            <p className="mt-3 rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
              Reply preview
            </p>
          ) : (
            <p className="mt-3 text-sm font-semibold">
              {title.trim() || "Post title preview"}
            </p>
          )}

          <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            {(lines.length > 0 ? lines : ["Body preview"]).slice(0, 4).map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>

          <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">
              Upvote
            </span>
            <span className="rounded-full border border-border px-2 py-0.5">
              Reply
            </span>
            <span className="rounded-full border border-border px-2 py-0.5">
              Share
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
