import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforcePublicToolRateLimit } from "@/lib/rateLimit/publicTools";
import { requireSession } from "@/lib/server/auth-guards";
import { assessRisk } from "@/lib/content/generator";
import { fetchSubredditDataWithCache } from "@/lib/subreddit/rulesFetchCache";
import { parseSubredditRules } from "@/lib/subreddit/rulesParser";
import { generateDraftVariantsWithOpenAI } from "@/lib/content/openaiVariants";
import {
  buildPostGeneratorFallbackVariants,
  type PostGeneratorGoal,
} from "@/lib/content/postGeneratorTool";

const schema = z.object({
  topic: z.string().min(3).max(200),
  product: z.string().min(2).max(120),
  audience: z.string().min(2).max(120).optional().default("founders"),
  tone: z.string().min(2).max(60).optional().default("helpful"),
  goal: z
    .enum(["awareness", "feedback", "launch", "case-study"])
    .optional()
    .default("feedback"),
  subreddit: z.string().min(2).max(120).optional(),
});

function goalInstruction(goal: PostGeneratorGoal) {
  if (goal === "awareness") {
    return "Spark awareness by sharing one practical learning and ending with a discussion question.";
  }
  if (goal === "launch") {
    return "Frame this as a low-hype launch update focused on transparency and lessons learned.";
  }
  if (goal === "case-study") {
    return "Present this as a mini case study with clear context, action, and outcome.";
  }
  return "Request specific feedback on approach, messaging, or tradeoffs.";
}

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
  const normalizedSubreddit = input.subreddit?.toLowerCase().replace(/^r\//, "");
  let policyHints: Record<string, unknown> | null = null;
  let rulesText: string | null = null;

  if (normalizedSubreddit) {
    const subreddit = await prisma.subredditCatalog.findFirst({
      where: { name: normalizedSubreddit },
      include: { policy: true },
    });
    policyHints = subreddit?.policy
      ? {
          promoAllowed: subreddit.policy.promoAllowed,
          linkPolicy: subreddit.policy.linkPolicy,
          flairRequired: subreddit.policy.flairRequired,
          noLinksInPosts: subreddit.policy.noLinksInPosts,
          textOnly: subreddit.policy.textOnly,
        }
      : null;

    try {
      const fetched = await fetchSubredditDataWithCache(normalizedSubreddit);
      const parsedRules = parseSubredditRules(fetched.data.rules);
      rulesText = parsedRules.rawRules;
      // Prefer fresh parser output when available; DB can be stale.
      policyHints = {
        promoAllowed: parsedRules.promoAllowed,
        linkPolicy: parsedRules.linkPolicy,
        flairRequired: parsedRules.flairRequired,
        noLinksInPosts: parsedRules.noLinksInPosts,
        textOnly: parsedRules.textOnly,
      };
    } catch {
      // Fall back to DB policy hints only.
    }
  }

  const taskInstructions = [
    `Create a reddit-ready draft about "${input.topic}" for ${input.audience}.`,
    goalInstruction(input.goal),
    "Use a discussion-first tone and avoid hard CTA language.",
    "Avoid promotional phrasing, link spam, and manipulative engagement bait.",
  ].join(" ");
  const llmGenerated = await generateDraftVariantsWithOpenAI({
    mode: "GENERATE",
    projectName: input.product,
    subredditName: normalizedSubreddit ?? null,
    subredditRulesText: rulesText,
    taskTitle: input.topic,
    taskInstructions,
    baseTitle: null,
    baseBody: "",
    variantCount: 3,
    preferredLength: "medium",
  }).catch(() => null);

  const generated =
    llmGenerated && llmGenerated.variants.length >= 3
      ? llmGenerated
      : buildPostGeneratorFallbackVariants({
          topic: input.topic,
          product: input.product,
          audience: input.audience,
          tone: input.tone,
          goal: input.goal,
          subredditName: normalizedSubreddit ?? null,
          subredditRulesText: rulesText,
        });
  const source = llmGenerated && llmGenerated.variants.length >= 3 ? "openai" : "fallback";

  const risk = assessRisk(
    generated.primary.title,
    generated.primary.body,
    rulesText,
  );

  return NextResponse.json({
    draft: {
      title: generated.primary.title,
      body: generated.primary.body,
    },
    variants: generated.variants,
    risk,
    policyHints,
    source,
    subredditRulesPreview: rulesText
      ?.split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 5),
    meta: {
      limitedBy: {
        limit: rl.limit,
        remaining: rl.remaining,
        resetAfterSeconds: rl.resetAfterSeconds,
      },
    },
  });
}
