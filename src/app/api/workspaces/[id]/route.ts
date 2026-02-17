import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaces, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  newOwnerId: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Verify user is admin of this workspace
    const member = await db.query.members.findFirst({
      where: and(eq(members.workspaceId, id), eq(members.userId, userId)),
    });

    if (!member || member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Transfer ownership
    if (data.newOwnerId) {
      if (workspace.ownerId !== userId) {
        return NextResponse.json(
          { error: "Only the workspace owner can transfer ownership" },
          { status: 403 }
        );
      }

      // Verify new owner is a member
      const newOwnerMember = await db.query.members.findFirst({
        where: and(
          eq(members.workspaceId, id),
          eq(members.userId, data.newOwnerId)
        ),
      });

      if (!newOwnerMember) {
        return NextResponse.json(
          { error: "New owner must be a workspace member" },
          { status: 400 }
        );
      }

      await db
        .update(workspaces)
        .set({
          ownerId: data.newOwnerId,
          ...(data.name ? { name: data.name } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, id));

      // Ensure new owner is admin
      if (newOwnerMember.role !== "admin") {
        await db
          .update(members)
          .set({ role: "admin" })
          .where(eq(members.id, newOwnerMember.id));
      }
    } else if (data.name) {
      await db
        .update(workspaces)
        .set({ name: data.name, updatedAt: new Date() })
        .where(eq(workspaces.id, id));
    }

    const updated = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    });

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating workspace:", error);
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

    const { id } = await params;

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (workspace.ownerId !== userId) {
      return NextResponse.json(
        { error: "Only the workspace owner can delete it" },
        { status: 403 }
      );
    }

    await db.delete(workspaces).where(eq(workspaces.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
