import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
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
        { error: "Only the workspace owner can schedule deletion" },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(workspaces)
      .set({ deletionScheduledAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    console.error("Error scheduling workspace deletion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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
        { error: "Only the workspace owner can cancel deletion" },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(workspaces)
      .set({ deletionScheduledAt: null, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    console.error("Error cancelling workspace deletion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
