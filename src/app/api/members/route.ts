import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireWorkspaceMember } from "@/lib/api-workspace";
import { AuthError } from "@/lib/api-workspace";

export async function GET() {
  try {
    const ctx = await requireWorkspaceMember();

    // Get all members for this workspace
    const allMembers = await db
      .select()
      .from(members)
      .where(eq(members.workspaceId, ctx.workspaceId));

    // Fetch Clerk user info for each member
    const clerk = await clerkClient();
    const membersWithInfo = await Promise.all(
      allMembers.map(async (member) => {
        try {
          const user = await clerk.users.getUser(member.userId);
          return {
            ...member,
            name:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              member.email,
            imageUrl: user.hasImage ? user.imageUrl : null,
          };
        } catch {
          return {
            ...member,
            name: member.email,
            imageUrl: null,
          };
        }
      })
    );

    // Determine current user's role
    const currentMember = allMembers.find((m) => m.userId === ctx.userId);
    const currentUserRole = currentMember?.role || null;

    return NextResponse.json({
      members: membersWithInfo,
      currentUserRole,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
