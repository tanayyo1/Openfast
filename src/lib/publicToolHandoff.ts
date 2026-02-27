import type { PostGeneratorGoal } from "@/lib/content/postGeneratorTool";

const POST_GENERATOR_HANDOFF_KEY = "rf_post_generator_handoff_v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PostGeneratorHandoff = {
  topic: string;
  product: string;
  audience: string;
  tone: string;
  goal: PostGeneratorGoal;
  subreddit: string | null;
  draftTitle: string | null;
  draftBody: string;
  source: "openai" | "fallback";
  createdAt: string;
};

export type ProjectPrefill = {
  name: string;
  description: string;
  brandVoice: string;
  primaryGoal: "Traffic" | "Feedback" | "Leads" | "Community";
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isPostGeneratorGoal(value: unknown): value is PostGeneratorGoal {
  return (
    value === "awareness" ||
    value === "feedback" ||
    value === "launch" ||
    value === "case-study"
  );
}

function normalizeGoal(goal: PostGeneratorGoal): ProjectPrefill["primaryGoal"] {
  if (goal === "feedback") return "Feedback";
  if (goal === "launch") return "Leads";
  if (goal === "case-study") return "Community";
  return "Traffic";
}

function normalizeTone(tone: string) {
  const normalized = collapseWhitespace(tone).toLowerCase();
  if (normalized.includes("data")) return "Data-driven and concrete. No hype.";
  if (normalized.includes("story"))
    return "Founder-story style with clear context and lessons.";
  if (normalized.includes("question"))
    return "Question-led and discussion-first. No hard CTA.";
  return "Helpful, clear, and practical. No hard CTA.";
}

function toString(value: unknown) {
  return typeof value === "string" ? collapseWhitespace(value) : "";
}

export function buildProjectPrefillFromPostGenerator(
  handoff: PostGeneratorHandoff,
): ProjectPrefill {
  const draftSnippet = collapseWhitespace(handoff.draftBody).slice(0, 220);
  const subredditHint = handoff.subreddit
    ? ` Primary subreddit focus: ${handoff.subreddit}.`
    : "";
  const draftHint =
    draftSnippet.length > 0 ? ` Initial draft angle: ${draftSnippet}` : "";

  return {
    name: collapseWhitespace(handoff.product),
    description: collapseWhitespace(
      `${handoff.product} helps ${handoff.audience}. Current Reddit focus: ${handoff.topic}.${subredditHint}${draftHint}`,
    ),
    brandVoice: normalizeTone(handoff.tone),
    primaryGoal: normalizeGoal(handoff.goal),
  };
}

export function savePostGeneratorHandoff(
  handoff: Omit<PostGeneratorHandoff, "createdAt">,
  storage?: StorageLike,
) {
  const localStorage = readStorage(storage);
  if (!localStorage) return false;

  const payload: PostGeneratorHandoff = {
    ...handoff,
    topic: collapseWhitespace(handoff.topic),
    product: collapseWhitespace(handoff.product),
    audience: collapseWhitespace(handoff.audience),
    tone: collapseWhitespace(handoff.tone),
    subreddit: handoff.subreddit ? collapseWhitespace(handoff.subreddit) : null,
    draftTitle: handoff.draftTitle
      ? collapseWhitespace(handoff.draftTitle)
      : null,
    draftBody: collapseWhitespace(handoff.draftBody),
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(POST_GENERATOR_HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function parsePostGeneratorHandoff(raw: string) {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (!isPostGeneratorGoal(parsed.goal)) return null;

  const topic = toString(parsed.topic);
  const product = toString(parsed.product);
  const audience = toString(parsed.audience);
  const tone = toString(parsed.tone);
  const draftBody = toString(parsed.draftBody);
  if (!topic || !product || !audience || !tone || !draftBody) return null;

  const source =
    parsed.source === "openai" || parsed.source === "fallback"
      ? parsed.source
      : "fallback";

  return {
    topic,
    product,
    audience,
    tone,
    goal: parsed.goal,
    subreddit: toString(parsed.subreddit) || null,
    draftTitle: toString(parsed.draftTitle) || null,
    draftBody,
    source,
    createdAt: toString(parsed.createdAt) || new Date().toISOString(),
  } satisfies PostGeneratorHandoff;
}

export function clearPostGeneratorHandoff(storage?: StorageLike) {
  const localStorage = readStorage(storage);
  if (!localStorage) return;
  try {
    localStorage.removeItem(POST_GENERATOR_HANDOFF_KEY);
  } catch {
    // Ignore storage failures to keep onboarding usable.
  }
}

export function readPostGeneratorHandoff(storage?: StorageLike) {
  const localStorage = readStorage(storage);
  if (!localStorage) return null;
  try {
    const raw = localStorage.getItem(POST_GENERATOR_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = parsePostGeneratorHandoff(raw);
    if (!parsed) {
      clearPostGeneratorHandoff(localStorage);
      return null;
    }
    return parsed;
  } catch {
    clearPostGeneratorHandoff(localStorage);
    return null;
  }
}

export function consumePostGeneratorHandoff(storage?: StorageLike) {
  const handoff = readPostGeneratorHandoff(storage);
  if (!handoff) return null;
  clearPostGeneratorHandoff(storage);
  return handoff;
}
