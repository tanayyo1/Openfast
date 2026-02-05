import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceSession } from "@/lib/server/auth-guards";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireWorkspaceSession();

  const scheduledPost = await prisma.scheduledPost.findFirst({
    where: {
      id: params.id,
      workspaceId: session.workspaceId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!scheduledPost) {
    return NextResponse.json(
      { error: "Scheduled post not found" },
      { status: 404 },
    );
  }

  if (scheduledPost.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: "Only scheduled posts can be cancelled" },
      { status: 400 },
    );
  }

  const updated = await prisma.scheduledPost.update({
    where: { id: scheduledPost.id },
    data: { status: "CANCELLED" },
    select: { id: true, status: true },
  });

  return NextResponse.json({ scheduledPost: updated }, { status: 200 });
}
