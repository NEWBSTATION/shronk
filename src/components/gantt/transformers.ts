import { differenceInDays, format } from 'date-fns';
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
 */
export function milestoneToSVARTask(milestone: Milestone): SVARTask {
  const start = toLocalMidnight(milestone.startDate);
  const end = toLocalMidnight(milestone.endDate);
  const duration = differenceInDays(end, start) + 1;

  return {
    id: milestone.id,
    text: milestone.title,
    start,
    end,
    duration,
    durationText: formatDurationText(start, end, duration),
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
    endDate: task.end,
  };
}
