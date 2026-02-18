import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { inviteLinks, members } from "@/db/schema";
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

    // Find invite link by token
    const link = await db.query.inviteLinks.findFirst({
      where: eq(inviteLinks.token, data.token),
      with: { workspace: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
    }

    if (new Date() > link.expiresAt) {
      await db.delete(inviteLinks).where(eq(inviteLinks.id, link.id));
      return NextResponse.json(
        { error: "This invite link has expired" },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, link.workspaceId),
        eq(members.userId, userId)
      ),
    });

    if (existingMember) {
      // Set workspace cookie and return
      const cookieStore = await cookies();
      cookieStore.set(WORKSPACE_COOKIE, link.workspaceId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      });

      return NextResponse.json({
        message: "You are already a member",
        workspaceId: link.workspaceId,
      });
    }

    // Get user email from Clerk
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email =
      user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress || "";

    // Create member with the link's role
    const [member] = await db
      .insert(members)
      .values({
        workspaceId: link.workspaceId,
        userId,
        email,
        role: link.role,
      })
      .returning();

    // Set workspace cookie
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, link.workspaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({
      member,
      workspaceId: link.workspaceId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error accepting invite link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
