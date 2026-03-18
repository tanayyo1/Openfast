/**
 * POST /api/monitor/posts/[id]/draft-reply
 *
 * Generates an AI comment draft for a monitored post.
 * Uses gpt-5.3 (draft-writer) for natural Reddit voice.
 * User reviews + copies to Reddit manually.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateChatText } from "@/lib/ai/openaiClient";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const SYSTEM_PROMPT = `You are an expert Reddit commenter. Write a helpful, genuine reply to a Reddit post.

Rules:
- Sound like a real person, not a brand
- Lead with value — answer the question, share experience, add a useful perspective
- If relevant, you can briefly mention the product but ONLY after providing genuine value
- Never use promotional language, CTAs, or link spam
- Keep it under 150 words
- Match the tone of the subreddit (casual for casual subs, technical for technical subs)
- No "As someone who..." or "Great question!" openers — just get to the point`;

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await requireWorkspaceSession();
  const postId = params.id;

  // Get the post + its project context
  const post = await prisma.monitoredPost.findUnique({
    where: { id: postId },
    include: {
      monitoredSubreddit: {
        include: {
          project: {
            select: { name: true, description: true, workspaceId: true },
          },
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json(
      { error: "Post not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  // Ensure this post belongs to the user's workspace
  if (post.monitoredSubreddit.project.workspaceId !== ctx.workspaceId) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const userPrompt = [
    `Subreddit: r/${post.monitoredSubreddit.subreddit}`,
    `Post title: ${post.title}`,
    `Post content: ${post.snippet.slice(0, 500)}`,
    ``,
    `My product (mention only if naturally relevant):`,
    `Name: ${post.monitoredSubreddit.project.name}`,
    `What it does: ${post.monitoredSubreddit.project.description.slice(0, 300)}`,
    ``,
    `Write a helpful Reddit comment replying to this post.`,
  ].join("\n");

  const draft = await generateChatText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    feature: "draft-writer", // gpt-5.3 for natural voice
    maxTokens: 400,
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Failed to generate draft", code: "AI_FAILED" },
      { status: 502 },
    );
  }

  // Save the draft to the post
  await prisma.monitoredPost.update({
    where: { id: postId },
    data: {
      draftReply: draft,
      draftReplyAt: new Date(),
    },
  });

  return NextResponse.json({ draft });
}
