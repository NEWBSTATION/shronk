import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { requireWorkspaceAdmin, AuthError } from "@/lib/api-workspace";

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireWorkspaceAdmin();

    const { id } = await params;
    const body = await request.json();
    const data = updateRoleSchema.parse(body);

    // Find target member (scoped to workspace)
    const target = await db.query.members.findFirst({
      where: and(eq(members.id, id), eq(members.workspaceId, ctx.workspaceId)),
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot change own role
    if (target.userId === ctx.userId) {
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
        .where(
          and(
            eq(members.workspaceId, ctx.workspaceId),
            eq(members.role, "admin")
          )
        );
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
    const ctx = await requireWorkspaceAdmin();

    const { id } = await params;

    const target = await db.query.members.findFirst({
      where: and(eq(members.id, id), eq(members.workspaceId, ctx.workspaceId)),
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot remove self
    if (target.userId === ctx.userId) {
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
        .where(
          and(
            eq(members.workspaceId, ctx.workspaceId),
            eq(members.role, "admin")
          )
        );
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
