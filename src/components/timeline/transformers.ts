import { addDays, subDays, differenceInDays } from 'date-fns';
import type { Milestone, MilestoneDependency, Team, TeamMilestoneDuration } from '@/db/schema';
import type { SVARTask, SVARLink } from './types';

/** Unit multipliers for duration conversion */
export const DURATION_UNIT_MULTIPLIERS = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
} as const;

export type DurationUnit = keyof typeof DURATION_UNIT_MULTIPLIERS;

/**
 * Compute the inclusive day count between start and end dates.
 * e.g., Jan 1 to Jan 1 = 1 day, Jan 1 to Jan 7 = 7 days
 */
export function computeDurationDays(start: Date, inclusiveEnd: Date): number {
  return differenceInDays(inclusiveEnd, start) + 1;
}

/**
 * Auto-format a day count to the best human-readable string.
 * e.g., 7 → "1w", 14 → "2w", 35 → "1mo 5d", 365 → "1y"
 */
export function formatDuration(days: number): string {
  if (days <= 0) return '0d';

  const years = Math.floor(days / 365);
  let remaining = days % 365;
  const months = Math.floor(remaining / 30);
  remaining = remaining % 30;
  const weeks = Math.floor(remaining / 7);
  const d = remaining % 7;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (d > 0 || parts.length === 0) parts.push(`${d}d`);

  return parts.join(' ');
}

/**
 * Compute the inclusive end date from a start date and duration in days.
 * e.g., start=Jan 1, days=7 → Jan 7 (inclusive)
 */
export function computeEndDateFromDuration(start: Date, durationDays: number): Date {
  return addDays(start, Math.max(durationDays, 1) - 1);
}

/**
 * Pick the best-fit unit and value for a given day count.
 * e.g., 14 → { value: 2, unit: 'weeks' }, 35 → { value: 35, unit: 'days' }
 */
export function bestFitDurationUnit(days: number): { value: number; unit: DurationUnit } {
  if (days >= 365 && days % 365 === 0) return { value: days / 365, unit: 'years' };
  if (days >= 30 && days % 30 === 0) return { value: days / 30, unit: 'months' };
  if (days >= 7 && days % 7 === 0) return { value: days / 7, unit: 'weeks' };
  return { value: days, unit: 'days' };
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
  const days = computeDurationDays(start, inclusiveEnd);

  return {
    id: milestone.id,
    text: milestone.title,
    start,
    end,
    duration: days,
    durationText: formatDuration(days),
    progress: 0,
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

/* ========================================================================= */
/*  Team Track Helpers                                                        */
/* ========================================================================= */

const TEAM_TRACK_SEPARATOR = '__team__';

/** Compose a team track SVAR task ID: `{milestoneId}__team__{teamId}` */
export function makeTeamTrackId(milestoneId: string, teamId: string): string {
  return `${milestoneId}${TEAM_TRACK_SEPARATOR}${teamId}`;
}

/** Returns true if the ID is a team track composite ID */
export function isTeamTrackId(id: string): boolean {
  return id.includes(TEAM_TRACK_SEPARATOR);
}

/** Parse a team track ID into milestone + team IDs, or null if not a team track */
export function parseTeamTrackId(id: string): { milestoneId: string; teamId: string } | null {
  const idx = id.indexOf(TEAM_TRACK_SEPARATOR);
  if (idx === -1) return null;
  return {
    milestoneId: id.substring(0, idx),
    teamId: id.substring(idx + TEAM_TRACK_SEPARATOR.length),
  };
}

/**
 * Build SVAR tasks with team track support.
 *
 * When multiple teams are visible and a milestone has team tracks:
 * - The milestone becomes a `type: 'summary'` parent
 * - Each team gets a `type: 'task'` child with `parent: milestoneId`
 *
 * When only one team is visible: flat list using that team's dates.
 * When no team tracks exist: existing behavior unchanged.
 */
export function milestonesToSVARTasksWithTeamTracks(
  milestones: Milestone[],
  teamDurations: TeamMilestoneDuration[],
  teams: Team[],
  visibleTeamIds: string[]
): SVARTask[] {
  const tasks: SVARTask[] = [];

  // Index team durations by milestoneId
  const durationsByMilestone = new Map<string, TeamMilestoneDuration[]>();
  for (const td of teamDurations) {
    if (!durationsByMilestone.has(td.milestoneId)) {
      durationsByMilestone.set(td.milestoneId, []);
    }
    durationsByMilestone.get(td.milestoneId)!.push(td);
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  for (const milestone of milestones) {
    const milestoneTDs = durationsByMilestone.get(milestone.id) || [];
    // Filter to only visible teams
    const visibleTDs = milestoneTDs.filter((td) =>
      visibleTeamIds.includes(td.teamId)
    );

    if (visibleTDs.length === 0) {
      // No team tracks visible — render as normal task
      tasks.push(milestoneToSVARTask(milestone));
    } else {
      // Summary parent + child tracks (always, even with one team visible)
      // Parent dates already encompass all team tracks (unified reflow ensures this)
      const parentTask = milestoneToSVARTask(milestone);
      parentTask.type = 'summary';
      parentTask.open = true;

      tasks.push(parentTask);

      for (const td of visibleTDs) {
        const team = teamMap.get(td.teamId);
        if (!team) continue;

        const start = toLocalMidnight(td.startDate);
        const inclusiveEnd = toLocalMidnight(td.endDate);
        const end = addDays(inclusiveEnd, 1);
        const days = computeDurationDays(start, inclusiveEnd);

        tasks.push({
          id: makeTeamTrackId(milestone.id, td.teamId),
          text: team.name,
          start,
          end,
          duration: days,
          durationText: formatDuration(days),
          progress: 0,
          type: 'task',
          parent: milestone.id,
          $custom: {
            status: milestone.status,
            priority: milestone.priority,
            teamId: td.teamId,
            projectId: milestone.projectId,
            sortOrder: milestone.sortOrder,
            description: null,
            isTeamTrack: true,
            teamColor: team.color,
            teamName: team.name,
          },
        });
      }
    }
  }

  return tasks;
}
