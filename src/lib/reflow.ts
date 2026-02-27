import { addDays, differenceInDays } from "date-fns";

/* ========================================================================= */
/*  Types                                                                     */
/* ========================================================================= */

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
  lag?: number;
}

export interface ReflowUpdate {
  id: string;
  startDate: Date;
  endDate: Date;
  duration: number;
}

/* ========================================================================= */
/*  Team-track expansion helpers                                              */
/* ========================================================================= */

export interface DurationExpansion {
  id: string;
  oldDuration: number;
  newDuration: number;
}

/**
 * Expand parent milestone dates bidirectionally to contain all team track children.
 *
 * Mutates the `milestones` array in place so the subsequent `reflowProject()`
 * sees the expanded dates. Returns a list of expansions for persistence.
 *
 * @param milestones - mutable array of milestones (will be mutated)
 * @param teamDurations - team tracks with their independent start/end dates
 */
export function expandDurationsFromTeamTracks(
  milestones: ReflowMilestone[],
  teamDurations: { milestoneId: string; startDate: Date; endDate: Date }[]
): DurationExpansion[] {
  // Compute min start and max end per parent from children
  const childRanges = new Map<string, { minStart: Date; maxEnd: Date }>();
  for (const td of teamDurations) {
    const existing = childRanges.get(td.milestoneId);
    if (existing) {
      if (td.startDate < existing.minStart) existing.minStart = td.startDate;
      if (td.endDate > existing.maxEnd) existing.maxEnd = td.endDate;
    } else {
      childRanges.set(td.milestoneId, {
        minStart: new Date(td.startDate.getTime()),
        maxEnd: new Date(td.endDate.getTime()),
      });
    }
  }

  const expansions: DurationExpansion[] = [];

  for (const m of milestones) {
    const range = childRanges.get(m.id);
    if (!range) continue;

    let newStart = m.startDate;
    let newEnd = m.endDate;
    let changed = false;

    if (range.minStart < m.startDate) {
      newStart = range.minStart;
      changed = true;
    }
    if (range.maxEnd > m.endDate) {
      newEnd = range.maxEnd;
      changed = true;
    }

    if (changed) {
      const newDuration = Math.max(1, differenceInDays(newEnd, newStart) + 1);
      expansions.push({
        id: m.id,
        oldDuration: m.duration,
        newDuration,
      });
      m.startDate = newStart;
      m.endDate = newEnd;
      m.duration = newDuration;
    }
  }

  return expansions;
}

export interface DerivedTeamDate {
  milestoneId: string;
  teamId: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  offset: number;
}

/**
 * Shift team track dates when their parent milestone moves.
 *
 * For each parent that moved, shift all its children by the same delta.
 * Children that don't have a moved parent are unchanged.
 *
 * @param parentMoves - Map<milestoneId, { oldStart, newStart }>
 * @param teamDurations - team tracks with their current dates
 */
export function shiftTeamTrackDates(
  parentMoves: Map<string, { oldStart: Date; newStart: Date }>,
  teamDurations: { milestoneId: string; teamId: string; startDate: Date; endDate: Date; duration: number }[]
): DerivedTeamDate[] {
  const results: DerivedTeamDate[] = [];

  for (const td of teamDurations) {
    const move = parentMoves.get(td.milestoneId);
    if (!move) continue;
    const delta = differenceInDays(move.newStart, move.oldStart);
    if (delta === 0) continue;

    results.push({
      milestoneId: td.milestoneId,
      teamId: td.teamId,
      startDate: addDays(td.startDate, delta),
      endDate: addDays(td.endDate, delta),
      duration: td.duration,
      offset: 0,
    });
  }

  return results;
}

/* ========================================================================= */
/*  Core reflow                                                               */
/* ========================================================================= */

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

  // Build predecessor map (successorId → Array<{ predId, lag }>)
  // and successor map (predecessorId → successorIds[])
  const predecessorMap = new Map<string, Array<{ predId: string; lag: number }>>();
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

    predecessorMap.get(dep.successorId)!.push({ predId: dep.predecessorId, lag: dep.lag ?? 0 });
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
      // Chained: start = max(each pred's endDate + 1 + lag)
      let maxStart = addDays(msMap.get(preds[0].predId)!.endDate, 1 + preds[0].lag);
      for (let i = 1; i < preds.length; i++) {
        const candidateStart = addDays(msMap.get(preds[i].predId)!.endDate, 1 + preds[i].lag);
        if (candidateStart > maxStart) maxStart = candidateStart;
      }
      newStart = maxStart;
    }

    // Compute end from duration (inclusive end date; 0-duration → endDate = startDate)
    const newEnd = ms.duration === 0 ? newStart : addDays(newStart, ms.duration - 1);

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
