import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import { milestones, milestoneDependencies } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { addDays, differenceInDays } from "date-fns";
import { capitalizeWords } from "@/lib/capitalize";
import { unifiedReflow, getTeamTrackBounds } from "@/lib/unified-reflow";
import { teamMilestoneDurations } from "@/db/schema";
import { getTransitiveSuccessors } from "@/lib/graph-utils";

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
        if (typeof d === "string") {
          const dt = new Date(d);
          return new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
        }
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }

      if (data.dragType === "resize-start") {
        // Save startDate + endDate + duration on dragged node.
        const start = new Date(data.startDate!);
        const end = data.endDate ? new Date(data.endDate!) : existingMilestone.endDate;
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

      // move or resize-end: save dates + BFS shift successors
      const newStart = new Date(data.startDate!);
      const newEnd = data.endDate ? new Date(data.endDate!) : existingMilestone.endDate;
      const duration = data.duration ?? Math.max(0, differenceInDays(newEnd, newStart) + 1);

      // Use client-provided original dates when available (prevents race conditions
      // when overlapping PATCH requests read stale DB state)
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

      // BFS transitive successors
      const allDeps = await db
        .select()
        .from(milestoneDependencies)
        .where(eq(milestoneDependencies.predecessorId, id));

      // Need all deps in the project for BFS
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
          const succStart = toLocalMidnight(succ.startDate);
          const succEnd = toLocalMidnight(succ.endDate);
          const shiftedStart = addDays(succStart, delta);
          const shiftedEnd = addDays(succEnd, delta);

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

      // Shift team track dates for successors + dragged node on move
      const teamShiftIds = data.dragType === "move"
        ? [id, ...successorIds]
        : [...successorIds];
      const teamDurs = teamShiftIds.length > 0
        ? await db
            .select()
            .from(teamMilestoneDurations)
            .where(inArray(teamMilestoneDurations.milestoneId, teamShiftIds))
        : [];

      const teamDateUpdates: Array<{ milestoneId: string; teamId: string; startDate: Date; endDate: Date; duration: number; offset: number }> = [];
      if (delta !== 0) {
        for (const td of teamDurs) {
          const newTdStart = addDays(toLocalMidnight(td.startDate), delta);
          const newTdEnd = addDays(toLocalMidnight(td.endDate), delta);
          teamDateUpdates.push({
            milestoneId: td.milestoneId,
            teamId: td.teamId,
            startDate: newTdStart,
            endDate: newTdEnd,
            duration: td.duration,
            offset: 0,
          });
        }
      }

      await Promise.all(
        teamDateUpdates.map((td) =>
          db
            .update(teamMilestoneDurations)
            .set({ startDate: td.startDate, endDate: td.endDate, offset: 0 })
            .where(
              and(
                eq(teamMilestoneDurations.milestoneId, td.milestoneId),
                eq(teamMilestoneDurations.teamId, td.teamId)
              )
            )
        )
      );

      const [updatedMilestone] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, id));

      return NextResponse.json({
        milestone: updatedMilestone,
        cascadedUpdates,
        teamCascadedUpdates: teamDateUpdates.map((td) => ({
          teamId: td.teamId,
          id: td.milestoneId,
          startDate: td.startDate.toISOString(),
          endDate: td.endDate.toISOString(),
          duration: td.duration,
          offset: td.offset,
        })),
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

    // Run unified reflow (authoritative — no skipIds)
    const { milestoneUpdates, teamDateUpdates } =
      await unifiedReflow(existingMilestone.projectId);

    return NextResponse.json({
      milestone: updatedMilestone,
      cascadedUpdates: milestoneUpdates
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
        offset: td.offset,
      })),
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
        offset: td.offset,
      })),
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
