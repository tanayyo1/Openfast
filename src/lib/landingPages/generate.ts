import { z } from "zod";
import { generateChatText } from "@/lib/ai/openaiClient";

const aiPayloadSchema = z.object({
  headline: z.string().min(8).max(180),
  subheadline: z.string().min(20).max(500),
  valueProps: z.array(z.string().min(8).max(220)).min(3).max(6),
  painPoints: z.array(z.string().min(8).max(220)).min(3).max(6),
  featureBullets: z.array(z.string().min(8).max(220)).min(3).max(8),
  socialProof: z.array(z.string().min(8).max(220)).min(2).max(5),
  faqs: z
    .array(
      z.object({
        question: z.string().min(8).max(220),
        answer: z.string().min(20).max(500),
      }),
    )
    .min(3)
    .max(6),
  finalCta: z.string().min(8).max(140).optional(),
  metaTitle: z.string().min(12).max(65).optional(),
  metaDescription: z.string().min(40).max(170).optional(),
});

export type GenerateLandingPageInput = {
  projectName: string;
  projectDescription: string;
  projectNiche: string;
  primaryKeyword: string;
  audience: string;
  tone: string;
  offer: string;
  ctaText: string;
};

export type LandingPageSections = {
  valueProps: string[];
  painPoints: string[];
  featureBullets: string[];
  socialProof: string[];
  faqs: Array<{ question: string; answer: string }>;
  finalCta: string;
};

export type GeneratedLandingPage = {
  name: string;
  slug: string;
  primaryKeyword: string;
  audience: string;
  tone: string;
  ctaText: string;
  headline: string;
  subheadline: string;
  sections: LandingPageSections;
  metaTitle: string;
  metaDescription: string;
  source: "openai" | "fallback";
};

function slugify(input: string) {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug.length > 0 ? slug : "landing-page";
}

function compactText(input: string, max: number) {
  return input.trim().replace(/\s+/g, " ").slice(0, max);
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

function buildFallbackLandingPage(
  input: GenerateLandingPageInput,
): GeneratedLandingPage {
  const keyword = compactText(input.primaryKeyword, 80);
  const headline = `Turn ${keyword} into consistent growth for ${input.audience}`;
  const subheadline = `${input.projectName} helps ${input.audience} solve ${input.projectNiche} challenges with a ${input.tone} workflow focused on practical outcomes.`;
  const finalCta = compactText(input.ctaText, 100);

  return {
    name: compactText(`${input.projectName} - ${keyword} landing page`, 120),
    slug: slugify(`${keyword}-${input.projectName}`),
    primaryKeyword: keyword,
    audience: compactText(input.audience, 120),
    tone: compactText(input.tone, 80),
    ctaText: finalCta,
    headline: compactText(headline, 180),
    subheadline: compactText(subheadline, 500),
    sections: {
      valueProps: [
        `Clarify ${keyword} strategy with a step-by-step execution plan.`,
        `Translate your ${input.projectNiche} expertise into customer-facing messaging.`,
        "Track measurable outcomes so each campaign iteration compounds.",
      ],
      painPoints: [
        `Teams spend too much time testing ${keyword} ideas that never convert.`,
        "Execution gets blocked by unclear ownership and weak prioritization.",
        "Messaging feels generic and fails to show concrete differentiation.",
      ],
      featureBullets: [
        `Positioning framework tailored to ${input.audience}.`,
        `Offer architecture that packages ${input.offer} into clear value tiers.`,
        "Performance loop with weekly experiments and conversion checkpoints.",
      ],
      socialProof: [
        "Built for operators who need repeatable growth systems.",
        "Designed to reduce guesswork and speed up decision cycles.",
      ],
      faqs: [
        {
          question: `Who is this ${keyword} page for?`,
          answer: `It is built for ${input.audience} that need a clear, execution-first way to capture demand and convert visitors.`,
        },
        {
          question: "How quickly can we launch?",
          answer:
            "Most teams can publish a first high-quality version in a single sprint, then iterate using feedback and conversion data.",
        },
        {
          question: "What should we optimize first?",
          answer:
            "Start with headline clarity, offer framing, and one trust section. These usually deliver the fastest conversion impact.",
        },
      ],
      finalCta,
    },
    metaTitle: compactText(`${keyword} | ${input.projectName}`, 65),
    metaDescription: compactText(
      `${input.projectName} helps ${input.audience} improve ${keyword} with practical playbooks, clear positioning, and measurable execution.`,
      170,
    ),
    source: "fallback",
  };
}

function normalizeAiLandingPage(input: {
  parsed: z.infer<typeof aiPayloadSchema>;
  base: GeneratedLandingPage;
}) {
  const base = input.base;
  const parsed = input.parsed;

  return {
    ...base,
    headline: compactText(parsed.headline, 180),
    subheadline: compactText(parsed.subheadline, 500),
    sections: {
      valueProps: parsed.valueProps.map((item) => compactText(item, 220)),
      painPoints: parsed.painPoints.map((item) => compactText(item, 220)),
      featureBullets: parsed.featureBullets.map((item) =>
        compactText(item, 220),
      ),
      socialProof: parsed.socialProof.map((item) => compactText(item, 220)),
      faqs: parsed.faqs.map((item) => ({
        question: compactText(item.question, 220),
        answer: compactText(item.answer, 500),
      })),
      finalCta: compactText(parsed.finalCta ?? base.ctaText, 100),
    },
    metaTitle: compactText(
      parsed.metaTitle ?? `${base.primaryKeyword} | ${base.name}`,
      65,
    ),
    metaDescription: compactText(
      parsed.metaDescription ?? base.metaDescription,
      170,
    ),
    source: "openai" as const,
  };
}

export async function generateLandingPage(input: GenerateLandingPageInput) {
  const fallback = buildFallbackLandingPage(input);
  if (!process.env.OPENAI_API_KEY) return fallback;

  const systemPrompt = [
    "You are a conversion-focused SaaS landing page copywriter.",
    "Output strict JSON only.",
    "Avoid hype, fake claims, and unverifiable statistics.",
    "Keep language clear, concrete, and trust-building.",
  ].join(" ");

  const userPrompt = [
    'Return JSON with this schema: {"headline":"string","subheadline":"string","valueProps":["..."],"painPoints":["..."],"featureBullets":["..."],"socialProof":["..."],"faqs":[{"question":"...","answer":"..."}],"finalCta":"string","metaTitle":"string","metaDescription":"string"}',
    `Project: ${input.projectName}`,
    `Description: ${input.projectDescription}`,
    `Niche: ${input.projectNiche}`,
    `Primary keyword: ${input.primaryKeyword}`,
    `Audience: ${input.audience}`,
    `Tone: ${input.tone}`,
    `Offer: ${input.offer}`,
    `Primary CTA: ${input.ctaText}`,
  ].join("\n");

  let raw: string | null = null;
  try {
    raw = await generateChatText({
      systemPrompt,
      userPrompt,
      temperature: 0.5,
      maxTokens: 1700,
    });
  } catch {
    return fallback;
  }

  if (!raw) return fallback;
  const jsonChunk = extractJsonObject(raw);
  if (!jsonChunk) return fallback;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonChunk) as unknown;
  } catch {
    return fallback;
  }

  const parsed = aiPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) return fallback;

  return normalizeAiLandingPage({ parsed: parsed.data, base: fallback });
}
