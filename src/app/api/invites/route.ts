import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { invites, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { sendInviteEmail } from "@/lib/email";
import { requireWorkspaceAdmin, AuthError } from "@/lib/api-workspace";

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("admin"),
});

export async function GET() {
  try {
    const ctx = await requireWorkspaceAdmin();

    const pendingInvites = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.workspaceId, ctx.workspaceId),
          eq(invites.status, "pending")
        )
      );

    return NextResponse.json({ invites: pendingInvites });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceAdmin();

    const body = await request.json();
    const data = createInviteSchema.parse(body);

    // Check if email is already a member of this workspace
    const existingMember = await db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, ctx.workspaceId),
        eq(members.email, data.email)
      ),
    });
    if (existingMember) {
      return NextResponse.json(
        { error: "This email is already a member" },
        { status: 400 }
      );
    }

    // Check for pending invite with same email in this workspace
    const existingInvite = await db.query.invites.findFirst({
      where: and(
        eq(invites.workspaceId, ctx.workspaceId),
        eq(invites.email, data.email),
        eq(invites.status, "pending")
      ),
    });
    if (existingInvite) {
      return NextResponse.json(
        { error: "A pending invite already exists for this email" },
        { status: 400 }
      );
    }

    // Generate token and create invite
    const token = randomBytes(32).toString("hex");
    const expiresAt = addDays(new Date(), 7);

    const [invite] = await db
      .insert(invites)
      .values({
        workspaceId: ctx.workspaceId,
        email: data.email,
        role: data.role,
        token,
        invitedBy: ctx.userId,
        expiresAt,
      })
      .returning();

    // Send invite email
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(ctx.userId);
      const inviterName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "Someone";
      await sendInviteEmail(data.email, token, inviterName, ctx.workspace.name);
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
    }

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
