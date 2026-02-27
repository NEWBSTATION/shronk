import { db } from "@/db";
import {
  milestones,
  milestoneDependencies,
  teamMilestoneDurations,
} from "@/db/schema";
import { eq, or, inArray, and } from "drizzle-orm";
import {
  reflowProject,
  expandDurationsFromTeamTracks,
  shiftTeamTrackDates,
  type ReflowMilestone,
  type ReflowDependency,
  type ReflowUpdate,
  type DurationExpansion,
  type DerivedTeamDate,
} from "@/lib/reflow";

function toLocalMidnight(date: Date | string): Date {
  if (typeof date === "string") {
    const d = new Date(date);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface UnifiedReflowResult {
  /** All milestone changes: expansions + dependency cascades merged together */
  milestoneUpdates: ReflowUpdate[];
  durationExpansions: DurationExpansion[];
  teamDateUpdates: DerivedTeamDate[];
}

/**
 * Single unified reflow for a project.
 *
 * 1. Fetches all milestones, deps, team durations (parallel)
 * 2. Computes max team duration per milestone
 * 3. Expands parent durations where team tracks exceed them
 * 4. Runs reflowProject() (single pass with correct durations)
 * 5. Derives team track dates from final milestone states
 * 6. Persists all changes in parallel
 */
export async function unifiedReflow(
  projectId: string,
  overrides?: Map<string, Partial<ReflowMilestone>>
): Promise<UnifiedReflowResult> {
  // 1. Fetch all data in parallel
  const allMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const milestoneIds = allMilestones.map((m) => m.id);

  const [allDeps, allTeamDurations] =
    milestoneIds.length > 0
      ? await Promise.all([
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
        ])
      : [[], []];

  // Build reflow inputs
  const reflowMilestones: ReflowMilestone[] = allMilestones.map((m) => ({
    id: m.id,
    startDate: toLocalMidnight(m.startDate),
    endDate: toLocalMidnight(m.endDate),
    duration: m.duration,
  }));

  // Snapshot original DB values BEFORE any mutations
  const originalMap = new Map<string, { startDate: Date; endDate: Date; duration: number }>();
  for (const m of reflowMilestones) {
    originalMap.set(m.id, {
      startDate: m.startDate,
      endDate: m.endDate,
      duration: m.duration,
    });
  }

  const reflowDeps: ReflowDependency[] = allDeps.map((d) => ({
    predecessorId: d.predecessorId,
    successorId: d.successorId,
    lag: d.lag,
  }));

  // 2-3. Expand parent dates bidirectionally to contain children (mutates reflowMilestones in-place)
  const durationExpansions = expandDurationsFromTeamTracks(
    reflowMilestones,
    allTeamDurations.map((td) => ({
      milestoneId: td.milestoneId,
      startDate: toLocalMidnight(td.startDate),
      endDate: toLocalMidnight(td.endDate),
    }))
  );

  // 4. Run single-pass reflow (creates internal copies, doesn't mutate reflowMilestones)
  const reflowUpdates = reflowProject(
    reflowMilestones,
    reflowDeps,
    overrides
  );

  // 5. Build final date map: expanded values + reflow overlays
  const milestoneDateMap = new Map<string, { startDate: Date; endDate: Date; duration: number }>();
  for (const m of reflowMilestones) {
    milestoneDateMap.set(m.id, {
      startDate: m.startDate,
      endDate: m.endDate,
      duration: m.duration,
    });
  }
  for (const u of reflowUpdates) {
    milestoneDateMap.set(u.id, {
      startDate: u.startDate,
      endDate: u.endDate,
      duration: u.duration,
    });
  }

  // Merge all milestone changes: expansions + reflow cascades
  const allMilestoneUpdates: ReflowUpdate[] = [];
  const seen = new Set<string>();

  for (const u of reflowUpdates) {
    allMilestoneUpdates.push(u);
    seen.add(u.id);
  }

  for (const exp of durationExpansions) {
    if (seen.has(exp.id)) continue;
    const dates = milestoneDateMap.get(exp.id)!;
    const orig = originalMap.get(exp.id)!;
    if (
      dates.startDate.getTime() !== orig.startDate.getTime() ||
      dates.endDate.getTime() !== orig.endDate.getTime() ||
      dates.duration !== orig.duration
    ) {
      allMilestoneUpdates.push({
        id: exp.id,
        startDate: dates.startDate,
        endDate: dates.endDate,
        duration: dates.duration,
      });
      seen.add(exp.id);
    }
  }

  // Shift team track dates when their parent moved during expansion/reflow
  const parentMoves = new Map<string, { oldStart: Date; newStart: Date }>();
  for (const m of reflowMilestones) {
    const orig = originalMap.get(m.id)!;
    const final = milestoneDateMap.get(m.id)!;
    if (orig.startDate.getTime() !== final.startDate.getTime()) {
      parentMoves.set(m.id, { oldStart: orig.startDate, newStart: final.startDate });
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

  // 6. Persist all changes in parallel
  const now = new Date();
  const milestoneWrites = allMilestoneUpdates
    .map((update) =>
      db
        .update(milestones)
        .set({
          startDate: update.startDate,
          endDate: update.endDate,
          duration: update.duration,
          updatedAt: now,
        })
        .where(eq(milestones.id, update.id))
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

  return {
    milestoneUpdates: allMilestoneUpdates,
    durationExpansions,
    teamDateUpdates,
  };
}

/**
 * Compute the date bounds of all team tracks for a given milestone.
 * Returns null if no team tracks exist.
 */
export async function getTeamTrackBounds(milestoneId: string): Promise<{ minStart: Date; maxEnd: Date } | null> {
  const rows = await db
    .select({ startDate: teamMilestoneDurations.startDate, endDate: teamMilestoneDurations.endDate })
    .from(teamMilestoneDurations)
    .where(eq(teamMilestoneDurations.milestoneId, milestoneId));

  if (rows.length === 0) return null;

  let minStart = toLocalMidnight(rows[0].startDate);
  let maxEnd = toLocalMidnight(rows[0].endDate);
  for (let i = 1; i < rows.length; i++) {
    const s = toLocalMidnight(rows[i].startDate);
    const e = toLocalMidnight(rows[i].endDate);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  }

  return { minStart, maxEnd };
}
