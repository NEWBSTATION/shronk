import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  milestones,
  projects,
  milestoneDependencies,
} from "@/db/schema";
import { eq, and, inArray, asc, desc, sql, ilike, or } from "drizzle-orm";
import { z } from "zod";

const createMilestoneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).default("not_started"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  progress: z.number().min(0).max(100).default(0),
  teamId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");
    const status = searchParams.getAll("status");
    const priority = searchParams.getAll("priority");
    const teamId = searchParams.getAll("teamId");
    const search = searchParams.get("search");
    const sortField = searchParams.get("sortField") || "sortOrder";
    const sortDirection = searchParams.get("sortDirection") || "asc";

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify user owns the project
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Build query conditions
    const conditions = [eq(milestones.projectId, projectId)];

    if (status.length > 0) {
      conditions.push(
        inArray(
          milestones.status,
          status as ("not_started" | "in_progress" | "on_hold" | "completed" | "cancelled")[]
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

    if (teamId.length > 0) {
      const teamConditions = teamId.includes("none")
        ? or(
            inArray(
              milestones.teamId,
              teamId.filter((t) => t !== "none")
            ),
            sql`${milestones.teamId} IS NULL`
          )
        : inArray(milestones.teamId, teamId);
      if (teamConditions) {
        conditions.push(teamConditions);
      }
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
    const sortColumn = {
      sortOrder: milestones.sortOrder,
      title: milestones.title,
      startDate: milestones.startDate,
      endDate: milestones.endDate,
      priority: milestones.priority,
      status: milestones.status,
    }[sortField] || milestones.sortOrder;

    const orderBy = sortDirection === "desc" ? desc(sortColumn) : asc(sortColumn);

    const result = await db
      .select()
      .from(milestones)
      .where(and(...conditions))
      .orderBy(orderBy);

    // Get dependencies for these milestones
    const milestoneIds = result.map((m) => m.id);
    const dependencies =
      milestoneIds.length > 0
        ? await db
            .select()
            .from(milestoneDependencies)
            .where(
              or(
                inArray(milestoneDependencies.predecessorId, milestoneIds),
                inArray(milestoneDependencies.successorId, milestoneIds)
              )
            )
        : [];

    return NextResponse.json({ milestones: result, dependencies });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createMilestoneSchema.parse(body);

    // Verify user owns the project
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, data.projectId), eq(projects.userId, userId)),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get max sortOrder for this project
    const maxSortOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(${milestones.sortOrder}), 0)` })
      .from(milestones)
      .where(eq(milestones.projectId, data.projectId));

    const [milestone] = await db
      .insert(milestones)
      .values({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        sortOrder: data.sortOrder || (maxSortOrder[0]?.max || 0) + 1,
      })
      .returning();

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating milestone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
