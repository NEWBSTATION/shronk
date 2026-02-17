import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { sendInviteEmail } from "@/lib/email";
import { requireWorkspaceAdmin, AuthError } from "@/lib/api-workspace";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireWorkspaceAdmin();

    const { id } = await params;

    const invite = await db.query.invites.findFirst({
      where: and(
        eq(invites.id, id),
        eq(invites.workspaceId, ctx.workspaceId)
      ),
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
    const user = await clerk.users.getUser(ctx.userId);
    const inviterName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || "Someone";
    await sendInviteEmail(invite.email, token, inviterName, ctx.workspace.name);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
    const ctx = await requireWorkspaceAdmin();

    const { id } = await params;

    const invite = await db.query.invites.findFirst({
      where: and(
        eq(invites.id, id),
        eq(invites.workspaceId, ctx.workspaceId)
      ),
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error revoking invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
