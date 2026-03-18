import OpenAI from "openai";

let openaiSingleton: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey });
  }
  return openaiSingleton;
}

/**
 * Per-feature model defaults.
 * Override any of these with env vars (e.g. OPENAI_MODEL_DRAFT_WRITER).
 */
export type AIFeature =
  | "draft-writer"
  | "landing-page"
  | "roadmap"
  | "risk-scoring"
  | "subreddit-analysis"
  | "general";

const FEATURE_MODEL_DEFAULTS: Record<AIFeature, string> = {
  "draft-writer": "gpt-5.3-chat-latest",
  "landing-page": "gpt-5.3-chat-latest",
  roadmap: "gpt-5.4-mini",
  "risk-scoring": "gpt-4.1-mini",
  "subreddit-analysis": "gpt-5.2",
  general: "gpt-5.4-mini",
};

const FEATURE_ENV_KEYS: Record<AIFeature, string> = {
  "draft-writer": "OPENAI_MODEL_DRAFT_WRITER",
  "landing-page": "OPENAI_MODEL_LANDING_PAGE",
  roadmap: "OPENAI_MODEL_ROADMAP",
  "risk-scoring": "OPENAI_MODEL_RISK_SCORING",
  "subreddit-analysis": "OPENAI_MODEL_SUBREDDIT_ANALYSIS",
  general: "OPENAI_MODEL",
};

export function modelForFeature(feature: AIFeature): string {
  const envKey = FEATURE_ENV_KEYS[feature];
  const envValue = envKey ? process.env[envKey] : undefined;
  if (envValue && envValue.trim().length > 0) return envValue.trim();
  return FEATURE_MODEL_DEFAULTS[feature];
}

function isNewApiModel(model: string): boolean {
  return (
    model.startsWith("gpt-5") ||
    model.startsWith("o3") ||
    model.startsWith("o4")
  );
}

export async function generateChatText(input: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  feature?: AIFeature;
  temperature?: number;
  maxTokens?: number;
}) {
  const client = getOpenAIClient();
  if (!client) return null;

  const model = input.model ?? modelForFeature(input.feature ?? "general");
  const useNewApi = isNewApiModel(model);

  const completion = await client.chat.completions.create({
    model,
    ...(useNewApi
      ? { max_completion_tokens: input.maxTokens ?? 1200 }
      : {
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 1200,
        }),
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? null;
  return text;
}
