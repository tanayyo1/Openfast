import type { DraftVariant } from "@/lib/content/generator";
import type { ContentGenerateMode } from "@/lib/queue/enqueue";
import { generateChatText } from "@/lib/ai/openaiClient";
import {
  PROMPT_KEYS,
  fallbackPromptBodyForKey,
  findActivePromptTemplateByKey,
  renderPromptTemplate,
} from "@/lib/prompts/templates";

export type OpenAIVariantsInput = {
  mode: ContentGenerateMode;
  projectName: string;
  subredditName: string | null;
  subredditRulesText: string | null;
  taskTitle: string | null;
  taskInstructions: string;
  baseTitle: string | null;
  baseBody: string;
  variantCount: number;
  preferredLength: "short" | "medium" | "long";
};

type GeneratedPayload = {
  variants: Array<{ title?: string | null; body?: string; score?: number }>;
};

function promptKeyForMode(mode: ContentGenerateMode) {
  if (mode === "REWRITE") return PROMPT_KEYS.CONTENT_REWRITE;
  if (mode === "COMPLIANCE") return PROMPT_KEYS.CONTENT_COMPLIANCE;
  return PROMPT_KEYS.CONTENT_GENERATE;
}

function maxCharsForLength(length: "short" | "medium" | "long") {
  if (length === "short") return 280;
  if (length === "long") return 1500;
  return 700;
}

function trimBody(body: string, length: "short" | "medium" | "long") {
  const max = maxCharsForLength(length);
  if (body.length <= max) return body;
  return `${body.slice(0, max - 3).trim()}...`;
}

function extractJsonObject(input: string) {
  const first = input.indexOf("{");
  if (first < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = first; i < input.length; i += 1) {
    const ch = input[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return input.slice(first, i + 1);
      if (depth < 0) return null;
    }
  }
  return null;
}

export async function generateDraftVariantsWithOpenAI(
  input: OpenAIVariantsInput,
) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const key = promptKeyForMode(input.mode);
  const template = await findActivePromptTemplateByKey(key);
  const baseSystemPrompt =
    template?.body && template.body.trim().length > 0
      ? template.body
      : fallbackPromptBodyForKey(key);

  const systemPrompt = renderPromptTemplate(baseSystemPrompt, {
    project_name: input.projectName,
    subreddit_name: input.subredditName ?? "",
    mode: input.mode,
  });

  const userPrompt = [
    "Return strict JSON only.",
    'Schema: {"variants":[{"title":"string|null","body":"string","score":0.0}]}',
    `Variant count requested: ${Math.max(3, Math.min(5, input.variantCount))}`,
    `Preferred length: ${input.preferredLength}`,
    `Task title: ${input.taskTitle ?? ""}`,
    `Task instructions: ${input.taskInstructions}`,
    `Subreddit: ${input.subredditName ?? ""}`,
    `Subreddit rules: ${input.subredditRulesText ?? ""}`,
    `Base title: ${input.baseTitle ?? ""}`,
    `Base body: ${input.baseBody}`,
  ].join("\n");

  const raw = await generateChatText({
    systemPrompt,
    userPrompt,
    feature: "draft-writer",
  });
  if (!raw) return null;

  const jsonString = extractJsonObject(raw);
  if (!jsonString) return null;

  let parsed: GeneratedPayload;
  try {
    parsed = JSON.parse(jsonString) as GeneratedPayload;
  } catch {
    return null;
  }

  if (!parsed.variants || !Array.isArray(parsed.variants)) return null;

  const variants: DraftVariant[] = parsed.variants
    .slice(0, 5)
    .map((item, index) => {
      const title =
        typeof item.title === "string" && item.title.trim().length > 0
          ? item.title.trim()
          : null;
      const body =
        typeof item.body === "string" && item.body.trim().length > 0
          ? trimBody(item.body.trim(), input.preferredLength)
          : "";
      const score =
        typeof item.score === "number" && Number.isFinite(item.score)
          ? Math.max(0, Math.min(1, item.score))
          : Number((0.9 - index * 0.1).toFixed(2));
      return { title, body, score };
    })
    .filter((variant) => variant.body.length > 0);

  if (variants.length === 0) return null;
  return { variants, primary: variants[0] };
}
