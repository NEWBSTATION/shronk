import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addDays, differenceInDays } from "date-fns";
import { capitalizeWords } from "@/lib/capitalize";
import { unifiedReflow, getMaxTeamDuration } from "@/lib/unified-reflow";

const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  sortOrder: z.number().optional(),
});

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

    // Enforce min duration >= max(team track durations)
    if (updateData.duration !== undefined) {
      const maxTeam = await getMaxTeamDuration(id);
      if (maxTeam > 0 && (updateData.duration as number) < maxTeam) {
        updateData.duration = maxTeam;
        const start = (updateData.startDate as Date) ?? existingMilestone.startDate;
        updateData.endDate = addDays(start, maxTeam - 1);
      }
    }

    // Update the milestone
    const [updatedMilestone] = await db
      .update(milestones)
      .set(updateData)
      .where(eq(milestones.id, id))
      .returning();

    // Run unified reflow (skip the milestone we just updated)
    const { milestoneUpdates, durationExpansions, teamDateUpdates } =
      await unifiedReflow(
        existingMilestone.projectId,
        undefined,
        new Set([id])
      );

    // Combine reflow updates + duration expansions for the response
    // (expansions that are also in milestoneUpdates are already covered)
    const allMilestoneChanges = [...milestoneUpdates];
    for (const exp of durationExpansions) {
      if (!milestoneUpdates.some((u) => u.id === exp.id)) {
        // Expansion happened but no date change from reflow — still report it
        // (the expansion itself was persisted by unifiedReflow)
      }
    }

    return NextResponse.json({
      milestone: updatedMilestone,
      cascadedUpdates: allMilestoneChanges
        .filter((u) => u.id !== id)
        .map((u) => ({
          id: u.id,
          startDate: u.startDate.toISOString(),
          endDate: u.endDate.toISOString(),
          duration: u.duration,
        })),
      teamCascadedUpdates: teamDateUpdates.map((td) => ({
        teamId: td.teamId,
        id: td.milestoneId,
        startDate: td.startDate.toISOString(),
        endDate: td.endDate.toISOString(),
        duration: td.duration,
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

    // Delete the milestone (cascade deletes dependencies + team durations)
    await db.delete(milestones).where(eq(milestones.id, id));

    // Run unified reflow on remaining milestones
    const { milestoneUpdates, teamDateUpdates } =
      await unifiedReflow(projectId);

    return NextResponse.json({
      success: true,
      cascadedUpdates: milestoneUpdates.map((u) => ({
        id: u.id,
        startDate: u.startDate.toISOString(),
        endDate: u.endDate.toISOString(),
        duration: u.duration,
      })),
      teamCascadedUpdates: teamDateUpdates.map((td) => ({
        teamId: td.teamId,
        id: td.milestoneId,
        startDate: td.startDate.toISOString(),
        endDate: td.endDate.toISOString(),
        duration: td.duration,
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
