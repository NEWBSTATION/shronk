import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, milestones } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const result = await db
      .select({
        milestoneId: projects.id,
        featureCount: sql<number>`COUNT(${milestones.id})::int`,
        completedFeatureCount: sql<number>`COUNT(CASE WHEN ${milestones.status} = 'completed' THEN 1 END)::int`,
      })
      .from(projects)
      .leftJoin(milestones, eq(projects.id, milestones.projectId))
      .where(eq(projects.workspaceId, ctx.workspaceId))
      .groupBy(projects.id);

    return NextResponse.json({ stats: result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching project stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
