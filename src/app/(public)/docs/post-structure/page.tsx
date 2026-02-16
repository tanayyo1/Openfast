import { GOOD_BAD_STRUCTURE_EXAMPLES } from "@/lib/content/postStructureValidator";
import Link from "next/link";

export default function PostStructureDocPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        RED-63
      </p>
      <h1 className="mt-4 text-3xl font-semibold">
        Post structure guide (Reddit conversion)
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Headline → Value → Product. Based on Diego (17K MRR, 1M Reddit reach):
        product too early = ignored or downvoted.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Good structure</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {GOOD_BAD_STRUCTURE_EXAMPLES.good.description}
        </p>
        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Title</p>
          <p className="mt-1">{GOOD_BAD_STRUCTURE_EXAMPLES.good.title}</p>
          <p className="mt-3 font-medium">Body (excerpt)</p>
          <p className="mt-1 line-clamp-4">
            {GOOD_BAD_STRUCTURE_EXAMPLES.good.body}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bad structure</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {GOOD_BAD_STRUCTURE_EXAMPLES.bad.description}
        </p>
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <p className="font-medium">Title</p>
          <p className="mt-1">{GOOD_BAD_STRUCTURE_EXAMPLES.bad.title}</p>
          <p className="mt-3 font-medium">Body</p>
          <p className="mt-1">{GOOD_BAD_STRUCTURE_EXAMPLES.bad.body}</p>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Full technical doc: <code>docs/POST_STRUCTURE_VALIDATOR.md</code>
      </p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm font-medium text-primary underline"
      >
        Back to home
      </Link>
    </div>
  );
}
