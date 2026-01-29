import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { milestones, projects } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    teamId: z.string().uuid().optional().nullable(),
    progress: z.number().min(0).max(100).optional(),
  }),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const bulkReorderSchema = z.object({
  projectId: z.string().uuid(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number(),
    })
  ),
});

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Handle reorder operation
    if (body.items && body.projectId) {
      const data = bulkReorderSchema.parse(body);

      // Verify user owns the project
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, data.projectId), eq(projects.userId, userId)),
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Update sort orders
      await Promise.all(
        data.items.map((item) =>
          db
            .update(milestones)
            .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
            .where(
              and(
                eq(milestones.id, item.id),
                eq(milestones.projectId, data.projectId)
              )
            )
        )
      );

      return NextResponse.json({ success: true });
    }

    // Handle bulk update
    const data = bulkUpdateSchema.parse(body);

    // Get milestones and verify ownership
    const existingMilestones = await db.query.milestones.findMany({
      where: inArray(milestones.id, data.ids),
      with: { project: true },
    });

    // Verify all milestones belong to user's projects
    const unauthorized = existingMilestones.some(
      (m) => m.project.userId !== userId
    );
    if (unauthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.updates.status !== undefined) {
      updateData.status = data.updates.status;
      if (data.updates.status === "completed") {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      }
    }
    if (data.updates.priority !== undefined) {
      updateData.priority = data.updates.priority;
    }
    if (data.updates.teamId !== undefined) {
      updateData.teamId = data.updates.teamId;
    }
    if (data.updates.progress !== undefined) {
      updateData.progress = data.updates.progress;
    }

    // Update all milestones
    await db
      .update(milestones)
      .set(updateData)
      .where(inArray(milestones.id, data.ids));

    return NextResponse.json({ success: true, updatedCount: data.ids.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in bulk update:", error);
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
    const data = bulkDeleteSchema.parse(body);

    // Get milestones and verify ownership
    const existingMilestones = await db.query.milestones.findMany({
      where: inArray(milestones.id, data.ids),
      with: { project: true },
    });

    // Verify all milestones belong to user's projects
    const unauthorized = existingMilestones.some(
      (m) => m.project.userId !== userId
    );
    if (unauthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(milestones).where(inArray(milestones.id, data.ids));

    return NextResponse.json({ success: true, deletedCount: data.ids.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in bulk delete:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
