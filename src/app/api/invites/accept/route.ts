import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { invites, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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
      // Mark as expired
      await db
        .update(invites)
        .set({ status: "expired" })
        .where(eq(invites.id, invite.id));
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await db.query.members.findFirst({
      where: eq(members.userId, userId),
    });
    if (existingMember) {
      // Mark invite as accepted anyway
      await db
        .update(invites)
        .set({ status: "accepted" })
        .where(eq(invites.id, invite.id));
      return NextResponse.json({ message: "You are already a member" });
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
        userId,
        email,
        role: invite.role,
      })
      .returning();

    await db
      .update(invites)
      .set({ status: "accepted" })
      .where(eq(invites.id, invite.id));

    return NextResponse.json({ member });
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
