import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  teamMilestoneDurations,
  milestones,
  projects,
  milestoneDependencies,
  teams,
} from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { addDays } from "date-fns";
import {
  reflowProjectPerTeam,
  type ReflowMilestone,
  type ReflowDependency,
} from "@/lib/reflow";

function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const upsertSchema = z.object({
  milestoneId: z.string().uuid(),
  teamId: z.string().uuid(),
  duration: z.number().int().min(1),
});

const deleteSchema = z.object({
  milestoneId: z.string().uuid(),
  teamId: z.string().uuid(),
});

async function fetchTeamReflowData(projectId: string) {
  const allMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const milestoneIds = allMilestones.map((m) => m.id);

  const allDeps =
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

  const allTeamDurations = await db
    .select()
    .from(teamMilestoneDurations)
    .where(inArray(teamMilestoneDurations.milestoneId, milestoneIds));

  const reflowMilestones: ReflowMilestone[] = allMilestones.map((m) => ({
    id: m.id,
    startDate: toLocalMidnight(m.startDate),
    endDate: toLocalMidnight(m.endDate),
    duration: m.duration,
  }));

  const reflowDeps: ReflowDependency[] = allDeps.map((d) => ({
    predecessorId: d.predecessorId,
    successorId: d.successorId,
  }));

  // Build teamDurations: Map<teamId, Map<milestoneId, duration>>
  const teamDurationsMap = new Map<string, Map<string, number>>();
  for (const td of allTeamDurations) {
    if (!teamDurationsMap.has(td.teamId)) {
      teamDurationsMap.set(td.teamId, new Map());
    }
    teamDurationsMap.get(td.teamId)!.set(td.milestoneId, td.duration);
  }

  return { reflowMilestones, reflowDeps, teamDurationsMap, allTeamDurations };
}

async function persistTeamReflowUpdates(
  results: { teamId: string; updates: { id: string; startDate: Date; endDate: Date; duration: number }[] }[]
) {
  for (const { teamId, updates } of results) {
    for (const update of updates) {
      await db
        .update(teamMilestoneDurations)
        .set({
          startDate: update.startDate,
          endDate: update.endDate,
          duration: update.duration,
        })
        .where(
          and(
            eq(teamMilestoneDurations.milestoneId, update.id),
            eq(teamMilestoneDurations.teamId, teamId)
          )
        );
    }
  }
}

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

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
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
    console.error("Error fetching team durations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = upsertSchema.parse(body);

    // Verify milestone exists and user owns it
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

    if (milestone.project.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify team exists and belongs to same project
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, data.teamId),
        eq(teams.projectId, milestone.projectId)
      ),
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Upsert the team duration
    const startDate = toLocalMidnight(milestone.startDate);
    const endDate = addDays(startDate, data.duration - 1);

    const existing = await db.query.teamMilestoneDurations.findFirst({
      where: and(
        eq(teamMilestoneDurations.milestoneId, data.milestoneId),
        eq(teamMilestoneDurations.teamId, data.teamId)
      ),
    });

    let teamDuration;
    if (existing) {
      [teamDuration] = await db
        .update(teamMilestoneDurations)
        .set({ duration: data.duration, startDate, endDate })
        .where(eq(teamMilestoneDurations.id, existing.id))
        .returning();
    } else {
      [teamDuration] = await db
        .insert(teamMilestoneDurations)
        .values({
          milestoneId: data.milestoneId,
          teamId: data.teamId,
          duration: data.duration,
          startDate,
          endDate,
        })
        .returning();
    }

    // Run per-team reflow
    const { reflowMilestones, reflowDeps, teamDurationsMap } =
      await fetchTeamReflowData(milestone.projectId);

    const teamReflowResults = reflowProjectPerTeam(
      reflowMilestones,
      reflowDeps,
      teamDurationsMap
    );

    await persistTeamReflowUpdates(teamReflowResults);

    // Re-fetch the updated team duration
    const updated = await db.query.teamMilestoneDurations.findFirst({
      where: eq(teamMilestoneDurations.id, teamDuration.id),
    });

    return NextResponse.json({
      teamDuration: updated,
      teamCascadedUpdates: teamReflowResults.flatMap((r) =>
        r.updates.map((u) => ({
          teamId: r.teamId,
          id: u.id,
          startDate: u.startDate.toISOString(),
          endDate: u.endDate.toISOString(),
          duration: u.duration,
        }))
      ),
    });
  } catch (error) {
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (milestone.project.userId !== userId) {
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

    // Reflow remaining team tracks
    const { reflowMilestones, reflowDeps, teamDurationsMap } =
      await fetchTeamReflowData(milestone.projectId);

    const teamReflowResults = reflowProjectPerTeam(
      reflowMilestones,
      reflowDeps,
      teamDurationsMap
    );

    await persistTeamReflowUpdates(teamReflowResults);

    return NextResponse.json({
      success: true,
      teamCascadedUpdates: teamReflowResults.flatMap((r) =>
        r.updates.map((u) => ({
          teamId: r.teamId,
          id: u.id,
          startDate: u.startDate.toISOString(),
          endDate: u.endDate.toISOString(),
          duration: u.duration,
        }))
      ),
    });
  } catch (error) {
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
