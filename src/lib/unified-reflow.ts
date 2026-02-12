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
  deriveTeamTrackDates,
  type ReflowMilestone,
  type ReflowDependency,
  type ReflowUpdate,
  type DurationExpansion,
  type DerivedTeamDate,
} from "@/lib/reflow";

function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
  overrides?: Map<string, Partial<ReflowMilestone>>,
  skipIds?: Set<string>
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
  }));

  // 2. Compute max team duration per milestone
  const maxTeamDurationMap = new Map<string, number>();
  for (const td of allTeamDurations) {
    const current = maxTeamDurationMap.get(td.milestoneId) ?? 0;
    if (td.duration > current) {
      maxTeamDurationMap.set(td.milestoneId, td.duration);
    }
  }

  // 3. Expand parent durations (mutates reflowMilestones in-place)
  const durationExpansions = expandDurationsFromTeamTracks(
    reflowMilestones,
    maxTeamDurationMap
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

  // Derive team track dates
  const teamDateUpdates = deriveTeamTrackDates(
    milestoneDateMap,
    allTeamDurations.map((td) => ({
      milestoneId: td.milestoneId,
      teamId: td.teamId,
      duration: td.duration,
    }))
  );

  // 6. Persist all changes in parallel
  const now = new Date();
  const milestoneWrites = allMilestoneUpdates
    .filter((u) => !skipIds?.has(u.id))
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
 * Compute the max team duration for a given milestone across all its team tracks.
 */
export async function getMaxTeamDuration(milestoneId: string): Promise<number> {
  const durations = await db
    .select({ duration: teamMilestoneDurations.duration })
    .from(teamMilestoneDurations)
    .where(eq(teamMilestoneDurations.milestoneId, milestoneId));

  if (durations.length === 0) return 0;
  return Math.max(...durations.map((d) => d.duration));
}
