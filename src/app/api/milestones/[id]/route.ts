import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  milestones,
  milestoneDependencies,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addDays, differenceInDays } from "date-fns";
import { capitalizeWords } from "@/lib/capitalize";
import { reflowProject, type ReflowMilestone, type ReflowDependency } from "@/lib/reflow";

function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  teamId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().optional(),
});

interface MilestoneUpdate {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number;
}

async function fetchProjectReflowData(projectId: string) {
  const allMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const allDeps = await db.select().from(milestoneDependencies);

  const reflowMilestones: ReflowMilestone[] = allMilestones.map((m) => ({
    id: m.id,
    startDate: toLocalMidnight(m.startDate),
    endDate: toLocalMidnight(m.endDate),
    duration: m.duration,
  }));

  const reflowDeps: ReflowDependency[] = allDeps
    .filter((d) => allMilestones.some((m) => m.id === d.predecessorId) && allMilestones.some((m) => m.id === d.successorId))
    .map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
    }));

  return { reflowMilestones, reflowDeps };
}

async function persistReflowUpdates(updates: MilestoneUpdate[]) {
  for (const update of updates) {
    await db
      .update(milestones)
      .set({
        startDate: update.startDate,
        endDate: update.endDate,
        duration: update.duration,
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, update.id));
  }
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

    // Duration-first date logic:
    // 1. If duration sent: store it, compute endDate = start + duration - 1
    // 2. If endDate sent (resize): derive duration = end - start + 1, store both
    // 3. If startDate sent (root move): keep duration, compute new endDate
    if (data.duration !== undefined) {
      updateData.duration = data.duration;
      const start = data.startDate
        ? new Date(data.startDate)
        : existingMilestone.startDate;
      updateData.startDate = start;
      updateData.endDate = addDays(start, data.duration - 1);
    } else if (data.endDate !== undefined && data.startDate !== undefined) {
      // Both dates sent (drag resize or move): derive duration
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const duration = differenceInDays(end, start) + 1;
      updateData.startDate = start;
      updateData.endDate = end;
      updateData.duration = Math.max(1, duration);
    } else if (data.endDate !== undefined) {
      // Only endDate (resize right edge): derive duration
      const end = new Date(data.endDate);
      const start = existingMilestone.startDate;
      const duration = differenceInDays(end, start) + 1;
      updateData.endDate = end;
      updateData.duration = Math.max(1, duration);
    } else if (data.startDate !== undefined) {
      // Only startDate (root move): keep duration, compute new end
      const start = new Date(data.startDate);
      const duration = existingMilestone.duration;
      updateData.startDate = start;
      updateData.endDate = addDays(start, duration - 1);
      updateData.duration = duration;
    }

    // Update the milestone
    const [updatedMilestone] = await db
      .update(milestones)
      .set(updateData)
      .where(eq(milestones.id, id))
      .returning();

    // Run reflow on entire project to cascade changes
    const { reflowMilestones, reflowDeps } = await fetchProjectReflowData(
      existingMilestone.projectId
    );

    const reflowUpdates = reflowProject(reflowMilestones, reflowDeps);

    // Filter out the milestone we just updated (it's already persisted)
    const cascadedUpdates = reflowUpdates.filter((u) => u.id !== id);

    // Persist cascaded changes
    await persistReflowUpdates(cascadedUpdates);

    return NextResponse.json({
      milestone: updatedMilestone,
      cascadedUpdates: cascadedUpdates.map((u) => ({
        id: u.id,
        startDate: u.startDate.toISOString(),
        endDate: u.endDate.toISOString(),
        duration: u.duration,
      })),
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

    const projectId = existingMilestone.projectId;

    // Delete the milestone (cascade deletes dependencies)
    await db.delete(milestones).where(eq(milestones.id, id));

    // Reflow remaining milestones to tighten chains
    const { reflowMilestones, reflowDeps } = await fetchProjectReflowData(projectId);
    const reflowUpdates = reflowProject(reflowMilestones, reflowDeps);

    await persistReflowUpdates(reflowUpdates);

    return NextResponse.json({
      success: true,
      cascadedUpdates: reflowUpdates.map((u) => ({
        id: u.id,
        startDate: u.startDate.toISOString(),
        endDate: u.endDate.toISOString(),
        duration: u.duration,
      })),
    });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
