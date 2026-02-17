import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { invites, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

const acceptSchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = acceptSchema.parse(body);

    // Find invite by token
    const invite = await db.query.invites.findFirst({
      where: eq(invites.token, data.token),
      with: { workspace: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: `Invite has already been ${invite.status}` },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      await db
        .update(invites)
        .set({ status: "expired" })
        .where(eq(invites.id, invite.id));
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 400 }
      );
    }

    // Check if user is already a member of this workspace
    const existingMember = await db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, invite.workspaceId),
        eq(members.userId, userId)
      ),
    });
    if (existingMember) {
      await db
        .update(invites)
        .set({ status: "accepted" })
        .where(eq(invites.id, invite.id));

      // Set workspace cookie
      const cookieStore = await cookies();
      cookieStore.set(WORKSPACE_COOKIE, invite.workspaceId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });

      return NextResponse.json({
        message: "You are already a member",
        workspaceId: invite.workspaceId,
      });
    }

    // Get user email from Clerk
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email =
      user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress || invite.email;

    // Create member and accept invite
    const [member] = await db
      .insert(members)
      .values({
        workspaceId: invite.workspaceId,
        userId,
        email,
        role: invite.role,
      })
      .returning();

    await db
      .update(invites)
      .set({ status: "accepted" })
      .where(eq(invites.id, invite.id));

    // Set workspace cookie
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, invite.workspaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      member,
      workspaceId: invite.workspaceId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
