import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, milestones } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all projects (milestones in the new terminology) with feature counts
    const result = await db
      .select({
        milestoneId: projects.id,
        featureCount: sql<number>`COUNT(${milestones.id})::int`,
        completedFeatureCount: sql<number>`COUNT(CASE WHEN ${milestones.status} = 'completed' THEN 1 END)::int`,
      })
      .from(projects)
      .leftJoin(milestones, eq(projects.id, milestones.projectId))
      .where(eq(projects.userId, userId))
      .groupBy(projects.id);

    return NextResponse.json({ stats: result });
  } catch (error) {
    console.error("Error fetching project stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
