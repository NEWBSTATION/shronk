import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";

const reorderSchema = z.object({
  orderedTeamIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = reorderSchema.parse(body);

    // Update sortOrder for each team
    await Promise.all(
      data.orderedTeamIds.map((id, index) =>
        db
          .update(teams)
          .set({ sortOrder: index })
          .where(eq(teams.id, id))
      )
    );

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
    console.error("Error reordering teams:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
