import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PROMPT_KEYS = {
  CONTENT_GENERATE: "content.generate",
  CONTENT_REWRITE: "content.rewrite",
  CONTENT_COMPLIANCE: "content.compliance",
} as const;

type PromptKey = (typeof PROMPT_KEYS)[keyof typeof PROMPT_KEYS];

export type PromptTemplateRecord = {
  id: string;
  key: string;
  version: number;
  title: string;
  body: string;
  variables: Prisma.JsonValue | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_PROMPT_BODIES: Record<PromptKey, string> = {
  [PROMPT_KEYS.CONTENT_GENERATE]:
    "You are an expert Reddit content strategist. Create practical, non-spammy drafts that maximize discussion quality and follow subreddit rules.",
  [PROMPT_KEYS.CONTENT_REWRITE]:
    "You are a Reddit editor. Rewrite existing draft content to improve clarity, value, and subreddit fit while preserving intent.",
  [PROMPT_KEYS.CONTENT_COMPLIANCE]:
    "You are a Reddit compliance reviewer. Transform drafts to reduce promotional risk and align with strict subreddit policy.",
};

export function fallbackPromptBodyForKey(key: PromptKey) {
  return DEFAULT_PROMPT_BODIES[key];
}

export async function listPromptTemplates(input?: {
  key?: string | null;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const where = input?.key
    ? Prisma.sql`WHERE key = ${input.key}`
    : Prisma.empty;

  return prisma.$queryRaw<PromptTemplateRecord[]>(Prisma.sql`
    SELECT
      id,
      key,
      version,
      title,
      body,
      variables,
      is_active AS "isActive",
      created_by AS "createdBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM prompt_templates
    ${where}
    ORDER BY key ASC, version DESC
    LIMIT ${limit}
  `);
}

export async function findPromptTemplateById(id: string) {
  const rows = await prisma.$queryRaw<PromptTemplateRecord[]>(Prisma.sql`
    SELECT
      id,
      key,
      version,
      title,
      body,
      variables,
      is_active AS "isActive",
      created_by AS "createdBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM prompt_templates
    WHERE id = ${id}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function findActivePromptTemplateByKey(key: string) {
  const rows = await prisma.$queryRaw<PromptTemplateRecord[]>(Prisma.sql`
    SELECT
      id,
      key,
      version,
      title,
      body,
      variables,
      is_active AS "isActive",
      created_by AS "createdBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM prompt_templates
    WHERE key = ${key}
      AND is_active = true
    ORDER BY version DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function createPromptTemplate(input: {
  key: string;
  title: string;
  body: string;
  variables?: Prisma.JsonValue;
  isActive: boolean;
  createdBy?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE prompt_templates
        SET is_active = false, updated_at = NOW()
        WHERE key = ${input.key}
          AND is_active = true
      `);
    }

    const versionRows = await tx.$queryRaw<Array<{ nextVersion: number }>>(
      Prisma.sql`
        SELECT COALESCE(MAX(version), 0) + 1 AS "nextVersion"
        FROM prompt_templates
        WHERE key = ${input.key}
      `,
    );
    const nextVersion = versionRows[0]?.nextVersion ?? 1;
    const variablesJson =
      typeof input.variables === "undefined"
        ? null
        : JSON.stringify(input.variables);

    const rows = await tx.$queryRaw<PromptTemplateRecord[]>(Prisma.sql`
      INSERT INTO prompt_templates (
        id,
        key,
        version,
        title,
        body,
        variables,
        is_active,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${randomUUID()},
        ${input.key},
        ${nextVersion},
        ${input.title},
        ${input.body},
        CAST(${variablesJson} AS jsonb),
        ${input.isActive},
        ${input.createdBy ?? null},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        key,
        version,
        title,
        body,
        variables,
        is_active AS "isActive",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);

    const created = rows[0];
    if (!created) throw new Error("PROMPT_TEMPLATE_CREATE_FAILED");
    return created;
  });
}

export async function activatePromptTemplate(id: string) {
  return prisma.$transaction(async (tx) => {
    const templateRows = await tx.$queryRaw<PromptTemplateRecord[]>(Prisma.sql`
      SELECT
        id,
        key,
        version,
        title,
        body,
        variables,
        is_active AS "isActive",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM prompt_templates
      WHERE id = ${id}
      LIMIT 1
    `);
    const template = templateRows[0] ?? null;
    if (!template) return null;

    await tx.$executeRaw(Prisma.sql`
      UPDATE prompt_templates
      SET is_active = false, updated_at = NOW()
      WHERE key = ${template.key}
        AND is_active = true
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE prompt_templates
      SET is_active = true, updated_at = NOW()
      WHERE id = ${template.id}
    `);

    return template;
  });
}

export function renderPromptTemplate(
  templateBody: string,
  variables: Record<string, string | number | boolean | null | undefined>,
) {
  let output = templateBody;
  for (const [key, value] of Object.entries(variables)) {
    const replaceWith =
      value === null || typeof value === "undefined" ? "" : String(value);
    output = output.replaceAll(`{{${key}}}`, replaceWith);
  }
  return output;
}
