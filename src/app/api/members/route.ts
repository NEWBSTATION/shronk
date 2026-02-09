import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Bootstrap: if no members exist, insert current user as admin
    const allMembers = await db.select().from(members);
    if (allMembers.length === 0) {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const email =
        user.emailAddresses.find(
          (e) => e.id === user.primaryEmailAddressId
        )?.emailAddress || "";

      const [newMember] = await db
        .insert(members)
        .values({ userId, email, role: "admin" })
        .returning();

      allMembers.push(newMember);
    }

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
            imageUrl: user.imageUrl,
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
    const currentMember = allMembers.find((m) => m.userId === userId);
    const currentUserRole = currentMember?.role || null;

    return NextResponse.json({
      members: membersWithInfo,
      currentUserRole,
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
