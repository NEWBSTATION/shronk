import { addDays, differenceInDays } from 'date-fns';
import type { Milestone, MilestoneDependency, Team, TeamMilestoneDuration } from '@/db/schema';
import type { TimelineTask, TimelineLink } from './types';

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
 * Convert a Milestone to TimelineTask format.
 * Uses inclusive dates — no +1/-1 day conversion needed.
 */
export function milestoneToTimelineTask(milestone: Milestone): TimelineTask {
  const startDate = toLocalMidnight(milestone.startDate);
  const endDate = toLocalMidnight(milestone.endDate);
  const days = computeDurationDays(startDate, endDate);

  return {
    id: milestone.id,
    text: milestone.title,
    startDate,
    endDate,
    duration: days,
    durationText: formatDuration(days),
    type: 'task',
    $custom: {
      status: milestone.status,
      priority: milestone.priority,
      projectId: milestone.projectId,
      sortOrder: milestone.sortOrder,
      description: milestone.description,
    },
  };
}

/**
 * Convert a TeamMilestoneDuration to a child TimelineTask.
 */
export function teamDurationToTimelineTask(
  milestone: Milestone,
  td: TeamMilestoneDuration,
  team: Team
): TimelineTask {
  const startDate = toLocalMidnight(td.startDate);
  const endDate = toLocalMidnight(td.endDate);
  const days = computeDurationDays(startDate, endDate);

  return {
    id: makeTeamTrackId(milestone.id, td.teamId),
    text: team.name,
    startDate,
    endDate,
    duration: days,
    durationText: formatDuration(days),
    type: 'task',
    parent: milestone.id,
    $custom: {
      status: milestone.status,
      priority: milestone.priority,
      projectId: milestone.projectId,
      sortOrder: milestone.sortOrder,
      description: null,
      isTeamTrack: true,
      teamColor: team.color,
      teamName: team.name,
    },
  };
}

/**
 * Convert a MilestoneDependency to TimelineLink format.
 */
export function dependencyToTimelineLink(dep: MilestoneDependency): TimelineLink {
  return {
    id: dep.id,
    sourceId: dep.predecessorId,
    targetId: dep.successorId,
  };
}

/* ========================================================================= */
/*  Team Track Helpers                                                        */
/* ========================================================================= */

const TEAM_TRACK_SEPARATOR = '__team__';

/** Compose a team track task ID: `{milestoneId}__team__{teamId}` */
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
 * Build TimelineTasks with team track support.
 *
 * When multiple teams are visible and a milestone has team tracks:
 * - The milestone becomes a `type: 'summary'` parent
 * - Each team gets a `type: 'task'` child with `parent: milestoneId`
 */
export function milestonesToTimelineTasksWithTeamTracks(
  milestones: Milestone[],
  teamDurations: TeamMilestoneDuration[],
  teams: Team[],
  visibleTeamIds: string[]
): TimelineTask[] {
  const tasks: TimelineTask[] = [];

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
    const visibleTDs = milestoneTDs
      .filter((td) => visibleTeamIds.includes(td.teamId))
      .sort((a, b) => a.teamId.localeCompare(b.teamId));

    if (visibleTDs.length === 0) {
      tasks.push(milestoneToTimelineTask(milestone));
    } else {
      const parentTask = milestoneToTimelineTask(milestone);
      parentTask.type = 'summary';
      tasks.push(parentTask);

      for (const td of visibleTDs) {
        const team = teamMap.get(td.teamId);
        if (!team) continue;
        tasks.push(teamDurationToTimelineTask(milestone, td, team));
      }
    }
  }

  return tasks;
}
