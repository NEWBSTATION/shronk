import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import {
  teamMilestoneDurations,
  milestones,
  milestoneDependencies,
  projects,
  teams,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { addDays, differenceInDays } from "date-fns";
import { getTransitiveSuccessors } from "@/lib/graph-utils";

function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const upsertSchema = z.object({
  milestoneId: z.string().uuid(),
  teamId: z.string().uuid(),
  duration: z.number().int().min(0),
  startDate: z.string().datetime().optional(),
  offset: z.number().int().min(0).optional().default(0),
});

const deleteSchema = z.object({
  milestoneId: z.string().uuid(),
  teamId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectMilestones = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(eq(milestones.projectId, projectId));

    const milestoneIds = projectMilestones.map((m) => m.id);

    const durations =
      milestoneIds.length > 0
        ? await db
            .select()
            .from(teamMilestoneDurations)
            .where(
              inArray(teamMilestoneDurations.milestoneId, milestoneIds)
            )
        : [];

    return NextResponse.json({ teamDurations: durations });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching team durations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = upsertSchema.parse(body);

    // Verify milestone exists and workspace owns it
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, data.milestoneId),
      with: { project: true },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (milestone.project.workspaceId !== ctx.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify team exists
    const team = await db.query.teams.findFirst({
      where: eq(teams.id, data.teamId),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Use provided startDate or fall back to existing/parent start
    const existing = await db.query.teamMilestoneDurations.findFirst({
      where: and(
        eq(teamMilestoneDurations.milestoneId, data.milestoneId),
        eq(teamMilestoneDurations.teamId, data.teamId)
      ),
    });

    let startDate: Date;
    let endDate: Date;
    let actualDuration: number;

    if (!existing && !data.startDate) {
      // New team track with no custom start: copy parent's raw dates directly
      // (bypasses toLocalMidnight to avoid timestamp-without-tz shift)
      startDate = milestone.startDate;
      endDate = milestone.endDate;
      actualDuration = milestone.duration;
    } else {
      startDate = data.startDate
        ? toLocalMidnight(data.startDate)
        : existing
          ? toLocalMidnight(existing.startDate)
          : toLocalMidnight(milestone.startDate);
      endDate = data.duration === 0
        ? startDate
        : addDays(startDate, data.duration - 1);
      actualDuration = data.duration;
    }

    let teamDuration;
    if (existing) {
      [teamDuration] = await db
        .update(teamMilestoneDurations)
        .set({ duration: actualDuration, offset: 0, startDate, endDate })
        .where(eq(teamMilestoneDurations.id, existing.id))
        .returning();
    } else {
      [teamDuration] = await db
        .insert(teamMilestoneDurations)
        .values({
          milestoneId: data.milestoneId,
          teamId: data.teamId,
          duration: actualDuration,
          offset: 0,
          startDate,
          endDate,
        })
        .returning();
    }

    // --- Targeted parent expansion (no full reflow — preserves overlaps) ---
    const now = new Date();
    const parentStart = toLocalMidnight(milestone.startDate);
    const parentEnd = toLocalMidnight(milestone.endDate);

    let newParentStart = parentStart;
    let newParentEnd = parentEnd;

    // Also check all sibling team tracks to compute full bounds
    const siblingTracks = await db
      .select()
      .from(teamMilestoneDurations)
      .where(eq(teamMilestoneDurations.milestoneId, data.milestoneId));

    for (const sib of siblingTracks) {
      const sibStart = toLocalMidnight(sib.startDate);
      const sibEnd = toLocalMidnight(sib.endDate);
      if (sibStart < newParentStart) newParentStart = sibStart;
      if (sibEnd > newParentEnd) newParentEnd = sibEnd;
    }

    const parentNeedsExpand =
      newParentStart.getTime() !== parentStart.getTime() ||
      newParentEnd.getTime() !== parentEnd.getTime();

    const cascadedUpdates: Array<{ id: string; startDate: string; endDate: string; duration: number }> = [];
    const teamCascadedUpdates: Array<{ teamId: string; id: string; startDate: string; endDate: string; duration: number; offset: number }> = [];

    if (parentNeedsExpand) {
      const newParentDuration = Math.max(1, differenceInDays(newParentEnd, newParentStart) + 1);

      await db
        .update(milestones)
        .set({ startDate: newParentStart, endDate: newParentEnd, duration: newParentDuration, updatedAt: now })
        .where(eq(milestones.id, data.milestoneId));

      cascadedUpdates.push({
        id: data.milestoneId,
        startDate: newParentStart.toISOString(),
        endDate: newParentEnd.toISOString(),
        duration: newParentDuration,
      });

      // If right edge grew, delta-shift transitive successors
      const rightDelta = differenceInDays(newParentEnd, parentEnd);
      if (rightDelta > 0) {
        // Build successor map for this project
        const projectMilestoneIds = (
          await db.select({ id: milestones.id }).from(milestones).where(eq(milestones.projectId, milestone.projectId))
        ).map((m) => m.id);

        const projectDeps = projectMilestoneIds.length > 0
          ? await db
              .select()
              .from(milestoneDependencies)
              .where(inArray(milestoneDependencies.predecessorId, projectMilestoneIds))
          : [];

        const successorMap = new Map<string, string[]>();
        for (const dep of projectDeps) {
          const list = successorMap.get(dep.predecessorId) || [];
          list.push(dep.successorId);
          successorMap.set(dep.predecessorId, list);
        }

        const successorIds = getTransitiveSuccessors(data.milestoneId, successorMap);

        if (successorIds.size > 0) {
          const successorMilestones = await db
            .select()
            .from(milestones)
            .where(inArray(milestones.id, [...successorIds]));

          for (const succ of successorMilestones) {
            const succStart = addDays(toLocalMidnight(succ.startDate), rightDelta);
            const succEnd = addDays(toLocalMidnight(succ.endDate), rightDelta);

            await db
              .update(milestones)
              .set({ startDate: succStart, endDate: succEnd, updatedAt: now })
              .where(eq(milestones.id, succ.id));

            cascadedUpdates.push({
              id: succ.id,
              startDate: succStart.toISOString(),
              endDate: succEnd.toISOString(),
              duration: succ.duration,
            });
          }

          // Shift team tracks of affected successors
          const affectedIds = [...successorIds];
          const succTeamDurs = affectedIds.length > 0
            ? await db
                .select()
                .from(teamMilestoneDurations)
                .where(inArray(teamMilestoneDurations.milestoneId, affectedIds))
            : [];

          for (const td of succTeamDurs) {
            const newTdStart = addDays(toLocalMidnight(td.startDate), rightDelta);
            const newTdEnd = addDays(toLocalMidnight(td.endDate), rightDelta);
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
      }
    }

    return NextResponse.json({
      teamDuration: teamDuration,
      cascadedUpdates,
      teamCascadedUpdates,
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
    console.error("Error upserting team duration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();

    const body = await request.json();
    const data = deleteSchema.parse(body);

    // Verify milestone and ownership
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, data.milestoneId),
      with: { project: true },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (milestone.project.workspaceId !== ctx.workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete the team duration entry
    await db
      .delete(teamMilestoneDurations)
      .where(
        and(
          eq(teamMilestoneDurations.milestoneId, data.milestoneId),
          eq(teamMilestoneDurations.teamId, data.teamId)
        )
      );

    // Parent keeps its duration per design — no auto-shrink, no full reflow
    return NextResponse.json({
      success: true,
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
    console.error("Error deleting team duration:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
