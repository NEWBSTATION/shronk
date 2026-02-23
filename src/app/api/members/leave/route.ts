import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members, workspaces } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { cookies } from "next/headers";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

const leaveSchema = z.object({
  transferTo: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();
    const body = await request.json();
    const { transferTo } = leaveSchema.parse(body);

    const isOwner = ctx.userId === ctx.workspace.ownerId;

    // If sole owner, must delete workspace instead
    if (isOwner) {
      const [memberCount] = await db
        .select({ count: count() })
        .from(members)
        .where(eq(members.workspaceId, ctx.workspaceId));

      if (memberCount.count <= 1) {
        return NextResponse.json(
          { error: "You're the only member. Delete the workspace instead." },
          { status: 400 }
        );
      }

      if (!transferTo) {
        return NextResponse.json(
          { error: "Owner must transfer ownership before leaving" },
          { status: 400 }
        );
      }

      // Verify transfer target is a member of this workspace
      const newOwner = await db.query.members.findFirst({
        where: and(
          eq(members.workspaceId, ctx.workspaceId),
          eq(members.userId, transferTo)
        ),
      });

      if (!newOwner) {
        return NextResponse.json(
          { error: "Transfer target is not a member of this workspace" },
          { status: 400 }
        );
      }

      // Transfer ownership and ensure new owner is admin
      await db
        .update(workspaces)
        .set({ ownerId: transferTo })
        .where(eq(workspaces.id, ctx.workspaceId));

      if (newOwner.role !== "admin") {
        await db
          .update(members)
          .set({ role: "admin" })
          .where(eq(members.id, newOwner.id));
      }
    }

    // Remove the leaving member
    await db
      .delete(members)
      .where(
        and(
          eq(members.workspaceId, ctx.workspaceId),
          eq(members.userId, ctx.userId)
        )
      );

    // Clear workspace cookie
    const cookieStore = await cookies();
    cookieStore.delete(WORKSPACE_COOKIE);

    return NextResponse.json({ success: true, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error leaving workspace:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
