import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { workspaces, members, invites } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's email for pending invites
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email =
      user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress || "";

    // Get all workspaces the user is a member of
    const userMembers = await db.query.members.findMany({
      where: eq(members.userId, userId),
      with: { workspace: true },
    });

    const userWorkspaces = userMembers.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      ownerId: m.workspace.ownerId,
      role: m.role,
      isOwner: m.workspace.ownerId === userId,
    }));

    // Get pending invites for the user's email
    const pendingInvites = await db.query.invites.findMany({
      where: and(eq(invites.email, email), eq(invites.status, "pending")),
      with: { workspace: true },
    });

    const pendingInvitesList = pendingInvites.map((inv) => ({
      id: inv.id,
      token: inv.token,
      role: inv.role,
      workspaceName: inv.workspace.name,
      workspaceId: inv.workspaceId,
      expiresAt: inv.expiresAt,
    }));

    return NextResponse.json({
      workspaces: userWorkspaces,
      pendingInvites: pendingInvitesList,
    });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createWorkspaceSchema.parse(body);

    // Get user email
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email =
      user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress || "";

    // Create workspace
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: data.name,
        ownerId: userId,
      })
      .returning();

    // Add creator as admin member
    await db.insert(members).values({
      workspaceId: workspace.id,
      userId,
      email,
      role: "admin",
    });

    // Set workspace cookie
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspace.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating workspace:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
