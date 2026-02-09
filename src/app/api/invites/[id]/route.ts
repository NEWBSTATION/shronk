import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { invites, members } from "@/db/schema";
import { eq } from "drizzle-orm";

async function requireAdmin(userId: string) {
  const member = await db.query.members.findFirst({
    where: eq(members.userId, userId),
  });
  if (!member || member.role !== "admin") return null;
  return member;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await requireAdmin(userId);
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    const invite = await db.query.invites.findFirst({
      where: eq(invites.id, id),
    });
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Can only revoke pending invites" },
        { status: 400 }
      );
    }

    await db
      .update(invites)
      .set({ status: "revoked" })
      .where(eq(invites.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
