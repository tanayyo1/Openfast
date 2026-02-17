import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";

const schema = z.object({
  topic: z.string().min(3).max(200),
  product: z.string().min(2).max(120),
  audience: z.string().min(2).max(120).optional().default("founders"),
  tone: z.string().min(2).max(60).optional().default("helpful"),
  subreddit: z.string().min(2).max(120).optional(),
});

export async function POST(req: Request) {
  const userId = await requireSession()
    .then((session) => session.user.id)
    .catch(() => null);
  const rl = await enforcePublicToolRateLimit({
    req,
    tool: "post-generate",
    userId,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_JSON" },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid input",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  let policyHints: Record<string, unknown> | null = null;
  if (input.subreddit) {
    const subreddit = await prisma.subredditCatalog.findFirst({
      where: { name: input.subreddit.toLowerCase() },
      include: { policy: true },
    });
    policyHints = subreddit?.policy
      ? {
          promoAllowed: subreddit.policy.promoAllowed,
          linkPolicy: subreddit.policy.linkPolicy,
          flairRequired: subreddit.policy.flairRequired,
        }
      : null;
  }

  const title = `How ${input.audience} are handling ${input.topic} in 2026`;
  const bodyLines = [
    `I'm building ${input.product} for ${input.audience} and testing a ${input.tone} approach to ${input.topic}.`,
    "What’s one tactic that worked for you recently?",
    "Happy to share what we tested if that helps others here.",
  ];

  if (policyHints && policyHints.linkPolicy !== "ALLOWED") {
    bodyLines.push("I will avoid links unless mods confirm they're allowed.");
  }

  return NextResponse.json({
    draft: {
      title,
      body: bodyLines.join("\n\n"),
    },
    policyHints,
    meta: {
      limitedBy: {
        limit: rl.limit,
        remaining: rl.remaining,
        resetAfterSeconds: rl.resetAfterSeconds,
      },
    },
  });
}
