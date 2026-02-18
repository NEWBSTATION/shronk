import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { requireWorkspaceAdmin, AuthError } from "@/lib/api-workspace";

function generateLink() {
  return {
    token: randomBytes(32).toString("hex"),
    expiresAt: addDays(new Date(), 7),
  };
}

// GET — fetch the active invite link, auto-creating one if none exists
export async function GET() {
  try {
    const ctx = await requireWorkspaceAdmin();

    let link = await db.query.inviteLinks.findFirst({
      where: eq(inviteLinks.workspaceId, ctx.workspaceId),
    });

    // Clean up expired link
    if (link && new Date() > link.expiresAt) {
      await db.delete(inviteLinks).where(eq(inviteLinks.id, link.id));
      link = undefined;
    }

    // Auto-create if none exists
    if (!link) {
      const { token, expiresAt } = generateLink();
      [link] = await db
        .insert(inviteLinks)
        .values({
          workspaceId: ctx.workspaceId,
          role: "member",
          token,
          createdBy: ctx.userId,
          expiresAt,
        })
        .returning();
    }

    return NextResponse.json({ inviteLink: link });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching invite link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const createSchema = z.object({
  role: z.enum(["admin", "member"]).default("member"),
});

// POST — create or reset the invite link (generates new token + 7-day expiry)
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceAdmin();

    const body = await request.json();
    const data = createSchema.parse(body);

    // Delete any existing link for this workspace
    await db
      .delete(inviteLinks)
      .where(eq(inviteLinks.workspaceId, ctx.workspaceId));

    // Create new link
    const token = randomBytes(32).toString("hex");
    const expiresAt = addDays(new Date(), 7);

    const [link] = await db
      .insert(inviteLinks)
      .values({
        workspaceId: ctx.workspaceId,
        role: data.role,
        token,
        createdBy: ctx.userId,
        expiresAt,
      })
      .returning();

    return NextResponse.json({ inviteLink: link }, { status: 201 });
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
    console.error("Error creating invite link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  role: z.enum(["admin", "member"]),
});

// PATCH — update role on the active invite link
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceAdmin();

    const body = await request.json();
    const data = updateSchema.parse(body);

    const link = await db.query.inviteLinks.findFirst({
      where: eq(inviteLinks.workspaceId, ctx.workspaceId),
    });

    if (!link) {
      return NextResponse.json({ error: "No invite link exists" }, { status: 404 });
    }

    const [updated] = await db
      .update(inviteLinks)
      .set({ role: data.role })
      .where(eq(inviteLinks.id, link.id))
      .returning();

    return NextResponse.json({ inviteLink: updated });
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
    console.error("Error updating invite link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
