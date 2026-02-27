import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember, AuthError } from "@/lib/api-workspace";
import { db } from "@/db";
import {
  milestones,
  milestoneDependencies,
  projects,
  teamMilestoneDurations,
} from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  tightenChainGaps,
  shiftTeamTrackDates,
  type ReflowMilestone,
  type ReflowDependency,
} from "@/lib/reflow";

function toLocalMidnight(date: Date | string): Date {
  if (typeof date === "string") {
    const d = new Date(date);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const bodySchema = z.object({
  projectId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWorkspaceMember();
    const body = await request.json();
    const { projectId } = bodySchema.parse(body);

    // Verify workspace owns the project
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, ctx.workspaceId)
      ),
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Fetch milestones + deps
    const allMilestones = await db
      .select()
      .from(milestones)
      .where(eq(milestones.projectId, projectId));

    const milestoneIds = allMilestones.map((m) => m.id);
    if (milestoneIds.length === 0) {
      return NextResponse.json({ cascadedUpdates: [], teamCascadedUpdates: [], count: 0 });
    }

    const [allDeps, allTeamDurations] = await Promise.all([
      db
        .select()
        .from(milestoneDependencies)
        .where(
          or(
            inArray(milestoneDependencies.predecessorId, milestoneIds),
            inArray(milestoneDependencies.successorId, milestoneIds)
          )
        ),
      db
        .select()
        .from(teamMilestoneDurations)
        .where(inArray(teamMilestoneDurations.milestoneId, milestoneIds)),
    ]);

    const reflowMilestones: ReflowMilestone[] = allMilestones.map((m) => ({
      id: m.id,
      startDate: toLocalMidnight(m.startDate),
      endDate: toLocalMidnight(m.endDate),
      duration: m.duration,
    }));

    // Snapshot originals for team track shifting
    const originalMap = new Map(
      reflowMilestones.map((m) => [m.id, { startDate: m.startDate }])
    );

    const reflowDeps: ReflowDependency[] = allDeps.map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
      lag: d.lag,
    }));

    // Gap-only tightening (preserves overlaps)
    const milestoneUpdates = tightenChainGaps(reflowMilestones, reflowDeps);

    // Shift team tracks for parents that moved
    const parentMoves = new Map<string, { oldStart: Date; newStart: Date }>();
    for (const u of milestoneUpdates) {
      const orig = originalMap.get(u.id);
      if (orig && orig.startDate.getTime() !== u.startDate.getTime()) {
        parentMoves.set(u.id, { oldStart: orig.startDate, newStart: u.startDate });
      }
    }

    const teamDateUpdates = shiftTeamTrackDates(
      parentMoves,
      allTeamDurations.map((td) => ({
        milestoneId: td.milestoneId,
        teamId: td.teamId,
        startDate: toLocalMidnight(td.startDate),
        endDate: toLocalMidnight(td.endDate),
        duration: td.duration,
      }))
    );

    // Persist
    const now = new Date();
    const milestoneWrites = milestoneUpdates.map((u) =>
      db
        .update(milestones)
        .set({
          startDate: u.startDate,
          endDate: u.endDate,
          duration: u.duration,
          updatedAt: now,
        })
        .where(eq(milestones.id, u.id))
    );

    const teamWrites = teamDateUpdates.map((td) =>
      db
        .update(teamMilestoneDurations)
        .set({
          startDate: td.startDate,
          endDate: td.endDate,
          offset: 0,
        })
        .where(
          and(
            eq(teamMilestoneDurations.milestoneId, td.milestoneId),
            eq(teamMilestoneDurations.teamId, td.teamId)
          )
        )
    );

    await Promise.all([...milestoneWrites, ...teamWrites]);

    const cascadedUpdates = milestoneUpdates.map((u) => ({
      id: u.id,
      startDate: u.startDate.toISOString(),
      endDate: u.endDate.toISOString(),
      duration: u.duration,
    }));

    const teamCascadedUpdates = teamDateUpdates.map((td) => ({
      id: td.milestoneId,
      teamId: td.teamId,
      startDate: td.startDate.toISOString(),
      endDate: td.endDate.toISOString(),
      duration: td.duration,
      offset: 0,
    }));

    return NextResponse.json({
      cascadedUpdates,
      teamCascadedUpdates,
      count: cascadedUpdates.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 }
      );
    }
    console.error("Failed to tighten gaps:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
