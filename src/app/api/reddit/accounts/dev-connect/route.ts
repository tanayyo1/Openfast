import { NextResponse } from "next/server";
import { SafetyTier } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptToken, TokenCryptoError } from "@/lib/security/tokenCrypto";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

const connectSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/),
  tier: z.enum(["NEW", "ESTABLISHED"]).default("NEW"),
});

function authError(err: unknown) {
  const code = err instanceof Error ? err.message : "UNAUTHORIZED";
  const status = code === "WORKSPACE_REQUIRED" ? 400 : 401;
  return NextResponse.json({ error: "Unauthorized", code }, { status });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Dev connect is disabled in production",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  let session;
  try {
    session = await requireWorkspaceSession();
  } catch (err) {
    return authError(err);
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

  const parsed = connectSchema.safeParse(json);
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

  const username = parsed.data.username;
  const existing = await prisma.redditAccount.findFirst({
    where: {
      workspaceId: session.workspaceId,
      redditUsername: username,
      isActive: true,
    },
    select: {
      id: true,
      redditUsername: true,
      safetyTier: true,
      createdAt: true,
    },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "Account already connected in this workspace",
        code: "ACCOUNT_ALREADY_CONNECTED",
      },
      { status: 409 },
    );
  }

  try {
    const now = new Date();
    const tier = parsed.data.tier as keyof typeof SafetyTier;
    const accessToken = encryptToken(`dev_access_${username}_${now.getTime()}`);
    const refreshToken = encryptToken(
      `dev_refresh_${username}_${now.getTime()}`,
    );

    const account = await prisma.redditAccount.create({
      data: {
        workspaceId: session.workspaceId,
        redditUsername: username,
        redditUserId: null,
        accessToken,
        refreshToken,
        tokenExpiry: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        scopes: ["identity", "read", "submit", "history"],
        linkKarma: tier === "ESTABLISHED" ? 250 : 10,
        commentKarma: tier === "ESTABLISHED" ? 500 : 20,
        accountAge: tier === "ESTABLISHED" ? 365 : 14,
        safetyTier: SafetyTier[tier],
        lastSyncAt: now,
        isActive: true,
      },
      select: {
        id: true,
        redditUsername: true,
        safetyTier: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    if (err instanceof TokenCryptoError) {
      return NextResponse.json(
        {
          error: "Token encryption is not configured",
          code: "TOKEN_ENCRYPTION_NOT_CONFIGURED",
        },
        { status: 500 },
      );
    }
    throw err;
  }
}
