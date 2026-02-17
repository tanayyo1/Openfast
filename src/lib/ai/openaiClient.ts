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

export async function generateChatText(input: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const client = getOpenAIClient();
  if (!client) return null;

  const completion = await client.chat.completions.create({
    model: input.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: input.temperature ?? 0.4,
    max_tokens: input.maxTokens ?? 1200,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? null;
  return text;
}
