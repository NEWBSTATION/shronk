import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { milestoneDependencies, milestones, projects } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { z } from "zod";

const createDependencySchema = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
});

const deleteDependencySchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

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

    // Get all milestones for this project
    const projectMilestones = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(eq(milestones.projectId, projectId));

    const milestoneIds = projectMilestones.map((m) => m.id);

    if (milestoneIds.length === 0) {
      return NextResponse.json({ dependencies: [] });
    }

    // Get dependencies involving these milestones
    const dependencies = await db
      .select()
      .from(milestoneDependencies)
      .where(
        or(
          inArray(milestoneDependencies.predecessorId, milestoneIds),
          inArray(milestoneDependencies.successorId, milestoneIds)
        )
      );

    return NextResponse.json({ dependencies });
  } catch (error) {
    console.error("Error fetching dependencies:", error);
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
    const data = createDependencySchema.parse(body);

    // Verify both milestones exist and belong to user's projects
    const [predecessor, successor] = await Promise.all([
      db.query.milestones.findFirst({
        where: eq(milestones.id, data.predecessorId),
        with: { project: true },
      }),
      db.query.milestones.findFirst({
        where: eq(milestones.id, data.successorId),
        with: { project: true },
      }),
    ]);

    if (!predecessor || !successor) {
      return NextResponse.json(
        { error: "One or both milestones not found" },
        { status: 404 }
      );
    }

    if (
      predecessor.project.userId !== userId ||
      successor.project.userId !== userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if milestones are in the same project
    if (predecessor.projectId !== successor.projectId) {
      return NextResponse.json(
        { error: "Milestones must be in the same project" },
        { status: 400 }
      );
    }

    // Check for circular dependency
    const existingDependencies = await db
      .select()
      .from(milestoneDependencies)
      .where(eq(milestoneDependencies.predecessorId, data.successorId));

    const wouldCreateCycle = existingDependencies.some(
      (d) => d.successorId === data.predecessorId
    );

    if (wouldCreateCycle) {
      return NextResponse.json(
        { error: "This would create a circular dependency" },
        { status: 400 }
      );
    }

    // Check if dependency already exists
    const existingDependency = await db.query.milestoneDependencies.findFirst({
      where: and(
        eq(milestoneDependencies.predecessorId, data.predecessorId),
        eq(milestoneDependencies.successorId, data.successorId)
      ),
    });

    if (existingDependency) {
      return NextResponse.json(
        { error: "Dependency already exists" },
        { status: 409 }
      );
    }

    const [dependency] = await db
      .insert(milestoneDependencies)
      .values(data)
      .returning();

    return NextResponse.json(dependency, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating dependency:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = deleteDependencySchema.parse(body);

    // Get dependency and verify ownership
    const existingDependency = await db.query.milestoneDependencies.findFirst({
      where: eq(milestoneDependencies.id, data.id),
      with: {
        predecessor: {
          with: { project: true },
        },
      },
    });

    if (!existingDependency) {
      return NextResponse.json(
        { error: "Dependency not found" },
        { status: 404 }
      );
    }

    if (existingDependency.predecessor.project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db
      .delete(milestoneDependencies)
      .where(eq(milestoneDependencies.id, data.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error deleting dependency:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
