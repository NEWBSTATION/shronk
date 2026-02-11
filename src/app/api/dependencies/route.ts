import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { milestoneDependencies, milestones, projects, teamMilestoneDurations } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { reflowProject, reflowProjectPerTeam, type ReflowMilestone, type ReflowDependency } from "@/lib/reflow";

function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const createDependencySchema = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
});

const deleteDependencySchema = z.object({
  id: z.string().uuid(),
});

async function fetchProjectReflowData(projectId: string) {
  const allMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const milestoneIds = allMilestones.map((m) => m.id);

  const allDeps = milestoneIds.length > 0
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

  return { reflowMilestones, reflowDeps };
}

async function persistReflowUpdates(updates: Array<{ id: string; startDate: Date; endDate: Date; duration: number }>) {
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

async function fetchAndRunTeamReflow(projectId: string) {
  const allMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const milestoneIds = allMilestones.map((m) => m.id);
  if (milestoneIds.length === 0) return [];

  const allDeps = milestoneIds.length > 0
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

  if (allTeamDurations.length === 0) return [];

  const reflowMs: ReflowMilestone[] = allMilestones.map((m) => ({
    id: m.id,
    startDate: toLocalMidnight(m.startDate),
    endDate: toLocalMidnight(m.endDate),
    duration: m.duration,
  }));

  const reflowDs: ReflowDependency[] = allDeps.map((d) => ({
    predecessorId: d.predecessorId,
    successorId: d.successorId,
  }));

  const teamDurationsMap = new Map<string, Map<string, number>>();
  for (const td of allTeamDurations) {
    if (!teamDurationsMap.has(td.teamId)) {
      teamDurationsMap.set(td.teamId, new Map());
    }
    teamDurationsMap.get(td.teamId)!.set(td.milestoneId, td.duration);
  }

  const teamResults = reflowProjectPerTeam(reflowMs, reflowDs, teamDurationsMap);

  for (const { teamId, updates } of teamResults) {
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

  return teamResults.flatMap((r) =>
    r.updates.map((u) => ({
      teamId: r.teamId,
      id: u.id,
      startDate: u.startDate.toISOString(),
      endDate: u.endDate.toISOString(),
      duration: u.duration,
    }))
  );
}

/**
 * Full BFS reachability check for cycle detection.
 * Returns true if `from` can reach `to` following existing dependencies.
 */
async function wouldCreateCycle(
  fromId: string,
  toId: string,
  projectId: string
): Promise<boolean> {
  // Get all milestones in the project
  const projectMilestones = await db
    .select({ id: milestones.id })
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const milestoneIds = projectMilestones.map((m) => m.id);
  if (milestoneIds.length === 0) return false;

  // Get all existing dependencies
  const deps = await db
    .select()
    .from(milestoneDependencies)
    .where(
      or(
        inArray(milestoneDependencies.predecessorId, milestoneIds),
        inArray(milestoneDependencies.successorId, milestoneIds)
      )
    );

  // Build successor adjacency (predecessorId → successorIds[])
  const successorMap = new Map<string, string[]>();
  for (const dep of deps) {
    const list = successorMap.get(dep.predecessorId) || [];
    list.push(dep.successorId);
    successorMap.set(dep.predecessorId, list);
  }

  // BFS from `fromId` to see if we can reach `toId`
  // (if successor `fromId` can reach predecessor `toId`, adding toId→fromId creates a cycle)
  const queue = [fromId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const succs = successorMap.get(current);
    if (succs) {
      for (const s of succs) queue.push(s);
    }
  }

  return false;
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

    // Full BFS cycle detection: check if successor can reach predecessor
    const cycleDetected = await wouldCreateCycle(
      data.successorId,
      data.predecessorId,
      predecessor.projectId
    );

    if (cycleDetected) {
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

    // Reflow project after creating the dependency
    const { reflowMilestones, reflowDeps } = await fetchProjectReflowData(
      predecessor.projectId
    );

    const reflowUpdates = reflowProject(reflowMilestones, reflowDeps);
    await persistReflowUpdates(reflowUpdates);

    // Run per-team reflow
    const teamCascadedUpdates = await fetchAndRunTeamReflow(predecessor.projectId);

    return NextResponse.json(
      {
        dependency,
        cascadedUpdates: reflowUpdates.map((u) => ({
          id: u.id,
          startDate: u.startDate.toISOString(),
          endDate: u.endDate.toISOString(),
          duration: u.duration,
        })),
        teamCascadedUpdates,
      },
      { status: 201 }
    );
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

    const projectId = existingDependency.predecessor.projectId;

    await db
      .delete(milestoneDependencies)
      .where(eq(milestoneDependencies.id, data.id));

    // Reflow project after removing the dependency
    const { reflowMilestones, reflowDeps } = await fetchProjectReflowData(projectId);
    const reflowUpdates = reflowProject(reflowMilestones, reflowDeps);
    await persistReflowUpdates(reflowUpdates);

    // Run per-team reflow
    const teamCascadedUpdates = await fetchAndRunTeamReflow(projectId);

    return NextResponse.json({
      success: true,
      cascadedUpdates: reflowUpdates.map((u) => ({
        id: u.id,
        startDate: u.startDate.toISOString(),
        endDate: u.endDate.toISOString(),
        duration: u.duration,
      })),
      teamCascadedUpdates,
    });
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
