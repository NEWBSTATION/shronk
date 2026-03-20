import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import { milestones, teamMilestoneDurations, milestoneDependencies } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getTransitiveSuccessors } from "@/lib/graph-utils";
import { z } from "zod";
import { addDays, differenceInDays } from "date-fns";
import { capitalizeWords } from "@/lib/capitalize";
import { getTeamTrackBounds } from "@/lib/unified-reflow";

const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  priority: z.enum(["none", "low", "medium", "high", "critical"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  sortOrder: z.number().optional(),
  dragType: z.enum(["move", "resize-start", "resize-end"]).optional(),
  // Client-provided pre-drag dates to prevent race conditions with overlapping requests
  originalStartDate: z.string().datetime().optional(),
  originalEndDate: z.string().datetime().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireWorkspaceMember();

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

    if (existingMilestone.project.workspaceId !== ctx.workspaceId) {
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

    // --- Delta-shift drag handler (ClickUp-style) ---
    // When dragType is present, bypass authoritative reflow and apply delta shifts.
    if (data.dragType) {
      const now = new Date();

      function toLocalMidnight(d: Date | string): Date {
        const dt = typeof d === "string" ? new Date(d) : d;
        return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      }

      if (data.dragType === "resize-start") {
        // Save startDate + endDate + duration on dragged node.
        const start = toLocalMidnight(data.startDate!);
        const end = data.endDate ? toLocalMidnight(data.endDate!) : existingMilestone.endDate;
        const duration = data.duration ?? Math.max(0, differenceInDays(end, start) + 1);

        await db
          .update(milestones)
          .set({ startDate: start, endDate: end, duration, updatedAt: now })
          .where(eq(milestones.id, id));

        // Use client-provided original dates when available (prevents race conditions)
        const baseStart = data.originalStartDate
          ? toLocalMidnight(new Date(data.originalStartDate))
          : toLocalMidnight(existingMilestone.startDate);

        // Shift this node's team tracks by the start-date delta
        const startDelta = differenceInDays(start, baseStart);
        const teamCascadedUpdates: Array<{ teamId: string; id: string; startDate: string; endDate: string; duration: number; offset: number }> = [];

        if (startDelta !== 0) {
          const nodeTDs = await db
            .select()
            .from(teamMilestoneDurations)
            .where(eq(teamMilestoneDurations.milestoneId, id));

          for (const td of nodeTDs) {
            const newTdStart = addDays(toLocalMidnight(td.startDate), startDelta);
            const newTdEnd = addDays(toLocalMidnight(td.endDate), startDelta);

            await db
              .update(teamMilestoneDurations)
              .set({ startDate: newTdStart, endDate: newTdEnd, offset: 0 })
              .where(
                and(
                  eq(teamMilestoneDurations.milestoneId, td.milestoneId),
                  eq(teamMilestoneDurations.teamId, td.teamId)
                )
              );

            teamCascadedUpdates.push({
              teamId: td.teamId,
              id: td.milestoneId,
              startDate: newTdStart.toISOString(),
              endDate: newTdEnd.toISOString(),
              duration: td.duration,
              offset: 0,
            });
          }
        }

        const [updatedMilestone] = await db
          .select()
          .from(milestones)
          .where(eq(milestones.id, id));

        return NextResponse.json({
          milestone: updatedMilestone,
          cascadedUpdates: [],
          teamCascadedUpdates,
        });
      }

      // move or resize-end: save dates + rigid delta-shift successors
      let newStart = toLocalMidnight(data.startDate!);
      let newEnd = data.endDate ? toLocalMidnight(data.endDate!) : existingMilestone.endDate;
      let duration = data.duration ?? Math.max(0, differenceInDays(newEnd, newStart) + 1);

      // Enforce parent contains all team tracks on resize-end
      if (data.dragType === "resize-end") {
        const bounds = await getTeamTrackBounds(id);
        if (bounds) {
          if (bounds.maxEnd > newEnd) newEnd = bounds.maxEnd;
          if (bounds.minStart < newStart) newStart = bounds.minStart;
          duration = Math.max(0, differenceInDays(newEnd, newStart) + 1);
        }
      }

      const oldStart = data.originalStartDate
        ? toLocalMidnight(new Date(data.originalStartDate))
        : toLocalMidnight(existingMilestone.startDate);
      const oldEnd = data.originalEndDate
        ? toLocalMidnight(new Date(data.originalEndDate))
        : toLocalMidnight(existingMilestone.endDate);

      const delta =
        data.dragType === "move"
          ? differenceInDays(newStart, oldStart)
          : differenceInDays(newEnd, oldEnd); // resize-end

      // Save dragged node
      await db
        .update(milestones)
        .set({ startDate: newStart, endDate: newEnd, duration, updatedAt: now })
        .where(eq(milestones.id, id));

      // Rigid delta-shift: apply the same delta to all transitive successors
      // This preserves relative positions and overlaps (no reflow/constraint enforcement)
      const projectDeps = await db
        .select()
        .from(milestoneDependencies)
        .where(
          inArray(
            milestoneDependencies.predecessorId,
            (await db.select({ id: milestones.id }).from(milestones).where(eq(milestones.projectId, existingMilestone.projectId))).map((m) => m.id)
          )
        );

      const successorMap = new Map<string, string[]>();
      for (const dep of projectDeps) {
        const list = successorMap.get(dep.predecessorId) || [];
        list.push(dep.successorId);
        successorMap.set(dep.predecessorId, list);
      }

      const successorIds = getTransitiveSuccessors(id, successorMap);
      const cascadedUpdates: Array<{ id: string; startDate: string; endDate: string; duration: number }> = [];

      if (delta !== 0 && successorIds.size > 0) {
        const successorMilestones = await db
          .select()
          .from(milestones)
          .where(inArray(milestones.id, [...successorIds]));

        for (const succ of successorMilestones) {
          const shiftedStart = addDays(toLocalMidnight(succ.startDate), delta);
          const shiftedEnd = addDays(toLocalMidnight(succ.endDate), delta);

          await db
            .update(milestones)
            .set({ startDate: shiftedStart, endDate: shiftedEnd, updatedAt: now })
            .where(eq(milestones.id, succ.id));

          cascadedUpdates.push({
            id: succ.id,
            startDate: shiftedStart.toISOString(),
            endDate: shiftedEnd.toISOString(),
            duration: succ.duration,
          });
        }
      }

      // Shift team tracks for dragged node + successors
      const teamShiftIds = data.dragType === "move"
        ? [id, ...successorIds]
        : [...successorIds];
      const teamCascadedUpdates: Array<{ teamId: string; id: string; startDate: string; endDate: string; duration: number; offset: number }> = [];

      if (delta !== 0 && teamShiftIds.length > 0) {
        const teamDurs = await db
          .select()
          .from(teamMilestoneDurations)
          .where(inArray(teamMilestoneDurations.milestoneId, teamShiftIds));

        for (const td of teamDurs) {
          const newTdStart = addDays(toLocalMidnight(td.startDate), delta);
          const newTdEnd = addDays(toLocalMidnight(td.endDate), delta);

          await db
            .update(teamMilestoneDurations)
            .set({ startDate: newTdStart, endDate: newTdEnd, offset: 0 })
            .where(
              and(
                eq(teamMilestoneDurations.milestoneId, td.milestoneId),
                eq(teamMilestoneDurations.teamId, td.teamId)
              )
            );

          teamCascadedUpdates.push({
            teamId: td.teamId,
            id: td.milestoneId,
            startDate: newTdStart.toISOString(),
            endDate: newTdEnd.toISOString(),
            duration: td.duration,
            offset: 0,
          });
        }
      }

      const [updatedMilestone] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, id));

      return NextResponse.json({
        milestone: updatedMilestone,
        cascadedUpdates,
        teamCascadedUpdates,
      });
    }

    // --- All non-drag updates (root or chained, same path) ---
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
      updateData.endDate = data.duration === 0 ? start : addDays(start, data.duration - 1);
    } else if (data.endDate !== undefined && data.startDate !== undefined) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const duration = Math.max(0, differenceInDays(end, start) + 1);
      updateData.startDate = start;
      updateData.endDate = end;
      updateData.duration = duration;
    } else if (data.endDate !== undefined) {
      const end = new Date(data.endDate);
      const start = existingMilestone.startDate;
      const duration = Math.max(0, differenceInDays(end, start) + 1);
      updateData.endDate = end;
      updateData.duration = duration;
    } else if (data.startDate !== undefined) {
      const start = new Date(data.startDate);
      const duration = existingMilestone.duration;
      updateData.startDate = start;
      updateData.endDate = duration === 0 ? start : addDays(start, duration - 1);
      updateData.duration = duration;
    }

    // Enforce parent contains all team tracks (date-based)
    if (updateData.startDate !== undefined || updateData.endDate !== undefined || updateData.duration !== undefined) {
      const bounds = await getTeamTrackBounds(id);
      if (bounds) {
        let start = (updateData.startDate as Date) ?? existingMilestone.startDate;
        let end = (updateData.endDate as Date) ?? existingMilestone.endDate;
        let changed = false;
        if (bounds.minStart < start) { start = bounds.minStart; changed = true; }
        if (bounds.maxEnd > end) { end = bounds.maxEnd; changed = true; }
        if (changed) {
          updateData.startDate = start;
          updateData.endDate = end;
          updateData.duration = Math.max(1, differenceInDays(end, start) + 1);
        }
      }
    }

    // Update the milestone
    const [updatedMilestone] = await db
      .update(milestones)
      .set(updateData)
      .where(eq(milestones.id, id))
      .returning();

    return NextResponse.json({
      milestone: updatedMilestone,
      cascadedUpdates: [],
      teamCascadedUpdates: [],
    });
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
    const ctx = await requireWorkspaceMember();

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

    if (existingMilestone.project.workspaceId !== ctx.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const projectId = existingMilestone.projectId;

    // Delete the milestone (cascade deletes dependencies + team durations)
    await db.delete(milestones).where(eq(milestones.id, id));

    return NextResponse.json({
      success: true,
      cascadedUpdates: [],
      teamCascadedUpdates: [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error deleting milestone:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
