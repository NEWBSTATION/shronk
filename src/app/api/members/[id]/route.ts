import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

async function requireAdmin(userId: string) {
  const member = await db.query.members.findFirst({
    where: eq(members.userId, userId),
  });
  if (!member || member.role !== "admin") return null;
  return member;
}

export async function PATCH(
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
    const body = await request.json();
    const data = updateRoleSchema.parse(body);

    // Find target member
    const target = await db.query.members.findFirst({
      where: eq(members.id, id),
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot change own role
    if (target.userId === userId) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    // If demoting an admin, check they're not the last admin
    if (target.role === "admin" && data.role === "member") {
      const [adminCount] = await db
        .select({ count: count() })
        .from(members)
        .where(eq(members.role, "admin"));
      if (adminCount.count <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin" },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(members)
      .set({ role: data.role })
      .where(eq(members.id, id))
      .returning();

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating member:", error);
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

    const target = await db.query.members.findFirst({
      where: eq(members.id, id),
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot remove self
    if (target.userId === userId) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 }
      );
    }

    // Cannot remove last admin
    if (target.role === "admin") {
      const [adminCount] = await db
        .select({ count: count() })
        .from(members)
        .where(eq(members.role, "admin"));
      if (adminCount.count <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin" },
          { status: 400 }
        );
      }
    }

    await db.delete(members).where(eq(members.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
