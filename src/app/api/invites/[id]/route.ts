import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { invites, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { sendInviteEmail } from "@/lib/email";

async function requireAdmin(userId: string) {
  const member = await db.query.members.findFirst({
    where: eq(members.userId, userId),
  });
  if (!member || member.role !== "admin") return null;
  return member;
}

export async function POST(
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
        { error: "Can only resend pending invites" },
        { status: 400 }
      );
    }

    // Generate new token and extend expiry
    const token = randomBytes(32).toString("hex");
    const expiresAt = addDays(new Date(), 7);

    await db
      .update(invites)
      .set({ token, expiresAt })
      .where(eq(invites.id, id));

    // Send email
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const inviterName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || "Someone";
    await sendInviteEmail(invite.email, token, inviterName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resending invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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
