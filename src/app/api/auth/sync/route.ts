import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    // Get the current user from Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already exists in our database
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email! },
    });

    if (existingUser) {
      // Update authId if not set
      if (!existingUser.authId) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { authId: user.id },
        });
      }

      // Return first workspace membership (owner/admin/member), deterministic by join time.
      const membership = await prisma.workspaceMember.findFirst({
        where: { userId: existingUser.id },
        orderBy: { createdAt: "asc" },
        include: { workspace: true },
      });

      return NextResponse.json({
        user: existingUser,
        workspace: membership?.workspace ?? null,
      });
    }

    // Get user metadata (name from signup)
    const name =
      user.user_metadata?.name || user.email?.split("@")[0] || "User";

    // Create user record
    const newUser = await prisma.user.create({
      data: {
        authId: user.id,
        email: user.email!,
        name,
        emailVerified: user.email_confirmed_at
          ? new Date(user.email_confirmed_at)
          : null,
      },
    });

    // Create default workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        ownerId: newUser.id,
        plan: "FREE",
        status: "ACTIVE",
        entitlements: {
          create: {
            maxProjects: 1,
            maxRedditAccounts: 1,
            maxScheduledPosts: 10,
            maxDraftsPerMonth: 10,
            roadmapDays: 7,
            hasAdvancedAnalytics: false,
            hasSmartFinder: false,
            hasTeamFeatures: false,
          },
        },
        // Create workspace membership for owner
        members: {
          create: {
            userId: newUser.id,
            role: "OWNER",
          },
        },
      },
    });

    return NextResponse.json({ user: newUser, workspace }, { status: 201 });
  } catch (error) {
    console.error("User sync error:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
