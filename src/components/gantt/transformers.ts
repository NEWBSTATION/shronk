import { addDays, subDays, differenceInDays, format } from 'date-fns';
import type { Milestone, MilestoneDependency } from '@/db/schema';
import type { SVARTask, SVARLink } from './types';

/**
 * Format a duration string showing date range and days
 * e.g., "Jan 15 - Feb 20 (36d)"
 */
function formatDurationText(start: Date, end: Date, days: number): string {
  const startStr = format(start, 'MMM d');
  const endStr = format(end, 'MMM d');
  return `${startStr} - ${endStr} (${days}d)`;
}

/**
 * Helper to parse a date and get midnight in local time
 * Handles both ISO strings (which may be UTC midnight) and Date objects
 */
export function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(year, month, day);
}

/**
 * Convert a Milestone to SVAR Task format
 *
 * SVAR uses exclusive end dates (end = day after last visible day).
 * Our DB stores inclusive end dates. We add 1 day when converting to SVAR
 * and subtract 1 day when converting back (see svarEndDateToInclusive).
 */
export function milestoneToSVARTask(milestone: Milestone): SVARTask {
  const start = toLocalMidnight(milestone.startDate);
  const inclusiveEnd = toLocalMidnight(milestone.endDate);
  const end = addDays(inclusiveEnd, 1); // inclusive → exclusive for SVAR
  const duration = differenceInDays(end, start);
  const displayDays = duration; // exclusive end means differenceInDays gives inclusive count

  return {
    id: milestone.id,
    text: milestone.title,
    start,
    end,
    duration,
    durationText: formatDurationText(start, inclusiveEnd, displayDays),
    progress: milestone.progress,
    type: 'task',
    // Store custom data for filtering/styling
    $custom: {
      status: milestone.status,
      priority: milestone.priority,
      teamId: milestone.teamId,
      projectId: milestone.projectId,
      sortOrder: milestone.sortOrder,
      description: milestone.description,
    },
  };
}

/**
 * Convert an array of Milestones to SVAR Tasks
 */
export function milestonesToSVARTasks(milestones: Milestone[]): SVARTask[] {
  return milestones.map(milestoneToSVARTask);
}

/**
 * Convert a MilestoneDependency to SVAR Link format
 */
export function dependencyToSVARLink(dep: MilestoneDependency): SVARLink {
  return {
    id: dep.id,
    source: dep.predecessorId,
    target: dep.successorId,
    type: 'e2s', // end-to-start (finish-to-start)
  };
}

/**
 * Convert an array of MilestoneDependencies to SVAR Links
 */
export function dependenciesToSVARLinks(dependencies: MilestoneDependency[]): SVARLink[] {
  return dependencies.map(dependencyToSVARLink);
}

/**
 * Convert SVAR's exclusive end date back to our inclusive end date.
 * SVAR returns end = day after the last visible day of the task.
 */
export function svarEndDateToInclusive(end: Date): Date {
  return subDays(end, 1);
}

/**
 * Convert SVAR Task back to Milestone update data
 * Used when SVAR fires update events (drag, resize, etc.)
 */
export function svarTaskToMilestoneUpdate(task: SVARTask): {
  id: string;
  startDate: Date;
  endDate: Date;
} {
  return {
    id: task.id,
    startDate: task.start,
    endDate: svarEndDateToInclusive(task.end),
  };
}
