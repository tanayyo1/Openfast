/**
 * AI Post Qualifier
 *
 * Takes a Reddit post and a project description.
 * Uses gpt-4.1-mini to score relevance 0-100.
 *
 * Why gpt-4.1-mini: This is a simple classification task.
 * We don't need creative writing quality, just "is this relevant?"
 * gpt-4.1-mini is fast (~0.7s) and cheap ($0.20/1M input).
 */

import { generateChatText } from "@/lib/ai/openaiClient";

export type QualifyResult = {
  score: number; // 0-100
  reason: string; // short explanation
};

const SYSTEM_PROMPT = `You are a relevance scorer for Reddit post monitoring.

Given a Reddit post title/snippet and a product description, score how relevant this post is for the product owner to engage with (write a helpful comment).

Score 0-100:
- 90-100: Perfect fit. The post is asking exactly about the problem this product solves.
- 70-89: Strong fit. Related topic, good opportunity to add value.
- 50-69: Moderate fit. Tangentially related, could work with the right angle.
- 30-49: Weak fit. Loosely related, probably not worth engaging.
- 0-29: Not relevant.

Return strict JSON only: {"score": N, "reason": "one sentence explanation"}`;

export async function qualifyPost(input: {
  postTitle: string;
  postSnippet: string;
  subreddit: string;
  projectName: string;
  projectDescription: string;
}): Promise<QualifyResult> {
  const userPrompt = [
    `Post title: ${input.postTitle}`,
    `Post snippet: ${input.postSnippet.slice(0, 300)}`,
    `Subreddit: r/${input.subreddit}`,
    `Product: ${input.projectName}`,
    `Product description: ${input.projectDescription.slice(0, 300)}`,
  ].join("\n");

  const raw = await generateChatText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    feature: "risk-scoring", // uses gpt-4.1-mini
    maxTokens: 150,
  });

  if (!raw) return { score: 0, reason: "AI unavailable" };

  try {
    const parsed = JSON.parse(raw) as { score?: number; reason?: string };
    return {
      score:
        typeof parsed.score === "number" && Number.isFinite(parsed.score)
          ? Math.max(0, Math.min(100, Math.round(parsed.score)))
          : 0,
      reason:
        typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    };
  } catch {
    return { score: 0, reason: "Failed to parse AI response" };
  }
}
