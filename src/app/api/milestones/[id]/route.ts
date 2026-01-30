import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  milestones,
  projects,
  milestoneDependencies,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { addDays, differenceInDays, isBefore } from "date-fns";
import { capitalizeWords } from "@/lib/capitalize";

const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  teamId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().optional(),
  cascadeDependencies: z.boolean().default(true),
});

interface MilestoneUpdate {
  id: string;
  startDate: Date;
  endDate: Date;
}

async function cascadeDependencies(
  milestoneId: string,
  newEndDate: Date,
  projectId: string
): Promise<MilestoneUpdate[]> {
  const updates: MilestoneUpdate[] = [];

  // Get all milestones for this project
  const allMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  // Get all dependencies
  const dependencies = await db.select().from(milestoneDependencies);

  // Find direct dependents (milestones that depend on this one)
  const directDependents = dependencies.filter(
    (d) => d.predecessorId === milestoneId
  );

  for (const dep of directDependents) {
    const dependent = allMilestones.find((m) => m.id === dep.successorId);
    if (!dependent) continue;

    const requiredStart = addDays(newEndDate, 1);

    if (isBefore(dependent.startDate, requiredStart)) {
      const duration = differenceInDays(dependent.endDate, dependent.startDate);
      const newDependentEnd = addDays(requiredStart, duration);

      updates.push({
        id: dependent.id,
        startDate: requiredStart,
        endDate: newDependentEnd,
      });

      // Recursively cascade
      const cascadedUpdates = await cascadeDependencies(
        dependent.id,
        newDependentEnd,
        projectId
      );
      updates.push(...cascadedUpdates);
    }
  }

  return updates;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateMilestoneSchema.parse(body);

    // Get milestone and verify ownership
    const existingMilestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, id),
      with: { project: true },
    });

    if (!existingMilestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (existingMilestone.project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = capitalizeWords(data.title);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "completed") {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      }
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.teamId !== undefined) updateData.teamId = data.teamId;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    // Update the milestone
    const [updatedMilestone] = await db
      .update(milestones)
      .set(updateData)
      .where(eq(milestones.id, id))
      .returning();

    // Handle dependency cascading if end date changed
    let cascadedUpdates: MilestoneUpdate[] = [];
    if (data.endDate && data.cascadeDependencies !== false) {
      const newEndDate = new Date(data.endDate);
      if (newEndDate > existingMilestone.endDate) {
        cascadedUpdates = await cascadeDependencies(
          id,
          newEndDate,
          existingMilestone.projectId
        );

        // Apply cascaded updates
        for (const update of cascadedUpdates) {
          await db
            .update(milestones)
            .set({
              startDate: update.startDate,
              endDate: update.endDate,
              updatedAt: new Date(),
            })
            .where(eq(milestones.id, update.id));
        }
      }
    }

    return NextResponse.json({
      milestone: updatedMilestone,
      cascadedUpdates,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating milestone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get milestone and verify ownership
    const existingMilestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, id),
      with: { project: true },
    });

    if (!existingMilestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (existingMilestone.project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(milestones).where(eq(milestones.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
