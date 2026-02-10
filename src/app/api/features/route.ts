import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { milestones, projects } from "@/db/schema";
import { eq, and, inArray, asc, desc, ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.getAll("status");
    const priority = searchParams.getAll("priority");
    const milestoneId = searchParams.getAll("milestoneId");
    const search = searchParams.get("search");
    const sortField = searchParams.get("sortField") || "sortOrder";
    const sortDirection = searchParams.get("sortDirection") || "asc";

    // Get all user's projects (milestones)
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId));

    const projectIds = userProjects.map((p) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json({ features: [], milestones: [] });
    }

    // Build conditions for features
    const conditions = [inArray(milestones.projectId, projectIds)];

    if (status.length > 0) {
      conditions.push(
        inArray(
          milestones.status,
          status as (
            | "not_started"
            | "in_progress"
            | "on_hold"
            | "completed"
            | "cancelled"
          )[]
        )
      );
    }

    if (priority.length > 0) {
      conditions.push(
        inArray(
          milestones.priority,
          priority as ("low" | "medium" | "high" | "critical")[]
        )
      );
    }

    if (milestoneId.length > 0) {
      conditions.push(inArray(milestones.projectId, milestoneId));
    }

    if (search) {
      conditions.push(
        or(
          ilike(milestones.title, `%${search}%`),
          ilike(milestones.description, `%${search}%`)
        )!
      );
    }

    // Build sort
    const sortColumn =
      {
        sortOrder: milestones.sortOrder,
        title: milestones.title,
        startDate: milestones.startDate,
        endDate: milestones.endDate,
        priority: milestones.priority,
        status: milestones.status,
        createdAt: milestones.createdAt,
      }[sortField] || milestones.sortOrder;

    const orderBy =
      sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn);

    // Get all features with their milestone info
    const features = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        title: milestones.title,
        description: milestones.description,
        startDate: milestones.startDate,
        endDate: milestones.endDate,
        status: milestones.status,
        priority: milestones.priority,
        progress: milestones.progress,
        teamId: milestones.teamId,
        duration: milestones.duration,
        sortOrder: milestones.sortOrder,
        completedAt: milestones.completedAt,
        createdAt: milestones.createdAt,
        updatedAt: milestones.updatedAt,
        milestoneName: projects.name,
        milestoneColor: projects.color,
        milestoneIcon: projects.icon,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(orderBy);

    // Get all milestones for filtering
    const allMilestones = await db
      .select({
        id: projects.id,
        name: projects.name,
        color: projects.color,
        icon: projects.icon,
        description: projects.description,
      })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.name));

    return NextResponse.json({ features, milestones: allMilestones });
  } catch (error) {
    console.error("Error fetching features:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
