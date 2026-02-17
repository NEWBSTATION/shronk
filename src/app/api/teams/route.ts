import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366f1"),
  autoAdd: z.boolean().optional().default(false),
});

const updateTeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  autoAdd: z.boolean().optional(),
});

const deleteTeamSchema = z.object({
  id: z.string().uuid(),
});

export async function GET() {
  try {
    const ctx = await requireWorkspaceMember();

    const result = await db
      .select()
      .from(teams)
      .where(eq(teams.workspaceId, ctx.workspaceId));

    return NextResponse.json({ teams: result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = createTeamSchema.parse(body);

    const [team] = await db
      .insert(teams)
      .values({
        workspaceId: ctx.workspaceId,
        ...data,
      })
      .returning();

    return NextResponse.json(team, { status: 201 });
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
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = updateTeamSchema.parse(body);

    const existingTeam = await db.query.teams.findFirst({
      where: and(eq(teams.id, data.id), eq(teams.workspaceId, ctx.workspaceId)),
    });

    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.autoAdd !== undefined) updateData.autoAdd = data.autoAdd;

    const [updated] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, data.id))
      .returning();

    return NextResponse.json(updated);
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
    console.error("Error updating team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = deleteTeamSchema.parse(body);

    const existingTeam = await db.query.teams.findFirst({
      where: and(eq(teams.id, data.id), eq(teams.workspaceId, ctx.workspaceId)),
    });

    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await db.delete(teams).where(eq(teams.id, data.id));

    return NextResponse.json({ success: true });
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
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
