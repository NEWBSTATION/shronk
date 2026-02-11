import { addDays } from "date-fns";

/* ========================================================================= */
/*  Per-team reflow                                                           */
/* ========================================================================= */

export interface TeamReflowResult {
  teamId: string;
  updates: ReflowUpdate[];
}

/**
 * Run reflow independently for each team that has duration overrides.
 *
 * For each team, builds a milestone list where durations come from the
 * team-specific map (falling back to the milestone default) and calls
 * the existing `reflowProject()`.
 *
 * @param milestones - all milestones in the project (with default dates/durations)
 * @param dependencies - all milestone dependencies
 * @param teamDurations - Map<teamId, Map<milestoneId, duration>>
 * @param overrides - optional per-milestone overrides applied before reflow
 */
export function reflowProjectPerTeam(
  milestones: ReflowMilestone[],
  dependencies: ReflowDependency[],
  teamDurations: Map<string, Map<string, number>>,
  overrides?: Map<string, Partial<ReflowMilestone>>
): TeamReflowResult[] {
  const results: TeamReflowResult[] = [];

  for (const [teamId, durationMap] of teamDurations) {
    // Build team-specific milestone list: use team duration if present, else milestone default
    const teamMilestones: ReflowMilestone[] = milestones.map((m) => {
      const teamDuration = durationMap.get(m.id);
      return {
        ...m,
        duration: teamDuration ?? m.duration,
      };
    });

    // Merge any explicit overrides (e.g. from a drag operation on a specific team track)
    const teamOverrides = overrides
      ? new Map(
          [...overrides].map(([id, ov]) => {
            // If the override has a duration, use it directly;
            // otherwise use the team-specific duration
            const teamDuration = durationMap.get(id);
            if (ov.duration === undefined && teamDuration !== undefined) {
              return [id, { ...ov, duration: teamDuration }];
            }
            return [id, ov];
          })
        )
      : undefined;

    const updates = reflowProject(teamMilestones, dependencies, teamOverrides);
    results.push({ teamId, updates });
  }

  return results;
}

/**
 * Minimal milestone shape needed for reflow computation.
 * Works with both server-side Milestone objects and client-side previews.
 */
export interface ReflowMilestone {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number;
}

export interface ReflowDependency {
  predecessorId: string;
  successorId: string;
}

export interface ReflowUpdate {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number;
}

/**
 * Pure function: reflow an entire project's milestones using tight chaining.
 *
 * - Root features (no predecessors): keep start date, compute end = start + duration - 1
 * - Chained features: start = max(predecessors' ends) + 1, end = start + duration - 1
 *
 * Uses Kahn's topological sort (BFS) to process in dependency order.
 * Returns only milestones whose dates actually changed.
 *
 * @param overrides - optional map of milestone ID → partial overrides to apply
 *   before reflowing (e.g., the dragged task's new duration or start date)
 */
export function reflowProject(
  milestones: ReflowMilestone[],
  dependencies: ReflowDependency[],
  overrides?: Map<string, Partial<ReflowMilestone>>
): ReflowUpdate[] {
  // Apply overrides to create working copies
  const msMap = new Map<string, ReflowMilestone>();
  for (const m of milestones) {
    const override = overrides?.get(m.id);
    msMap.set(m.id, override ? { ...m, ...override } : { ...m });
  }

  // Build predecessor map (successorId → predecessorIds[])
  // and successor map (predecessorId → successorIds[])
  const predecessorMap = new Map<string, string[]>();
  const successorMap = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const m of milestones) {
    predecessorMap.set(m.id, []);
    successorMap.set(m.id, []);
    inDegree.set(m.id, 0);
  }

  for (const dep of dependencies) {
    // Skip deps referencing milestones not in our set
    if (!msMap.has(dep.predecessorId) || !msMap.has(dep.successorId)) continue;

    predecessorMap.get(dep.successorId)!.push(dep.predecessorId);
    successorMap.get(dep.predecessorId)!.push(dep.successorId);
    inDegree.set(dep.successorId, (inDegree.get(dep.successorId) || 0) + 1);
  }

  // Kahn's topological sort
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const updates: ReflowUpdate[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const ms = msMap.get(id);
    if (!ms) continue;

    const preds = predecessorMap.get(id) || [];
    let newStart: Date;

    if (preds.length === 0) {
      // Root: keep existing start date
      newStart = ms.startDate;
    } else {
      // Chained: start = max(all predecessors' end dates) + 1
      let maxPredEnd = msMap.get(preds[0])!.endDate;
      for (let i = 1; i < preds.length; i++) {
        const predEnd = msMap.get(preds[i])!.endDate;
        if (predEnd > maxPredEnd) maxPredEnd = predEnd;
      }
      newStart = addDays(maxPredEnd, 1);
    }

    // Compute end from duration (inclusive end date)
    const newEnd = addDays(newStart, ms.duration - 1);

    // Check if dates actually changed
    const startChanged = newStart.getTime() !== ms.startDate.getTime();
    const endChanged = newEnd.getTime() !== ms.endDate.getTime();

    if (startChanged || endChanged) {
      updates.push({
        id,
        startDate: newStart,
        endDate: newEnd,
        duration: ms.duration,
      });
    }

    // Update the working copy so successors see the new end date
    ms.startDate = newStart;
    ms.endDate = newEnd;

    // Process successors
    for (const succId of successorMap.get(id) || []) {
      const newDegree = (inDegree.get(succId) || 1) - 1;
      inDegree.set(succId, newDegree);
      if (newDegree === 0) queue.push(succId);
    }
  }

  return updates;
}
