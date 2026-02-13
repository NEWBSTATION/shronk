import { addDays } from "date-fns";
import type { EventInput } from "@fullcalendar/core";

interface CalendarFeature {
  id: string;
  projectId: string;
  title: string;
  startDate: Date | string;
  endDate: Date | string;
  status: "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
  priority: "none" | "low" | "medium" | "high" | "critical";
  progress: number;
  duration: number;
  milestoneName: string;
  milestoneColor: string;
  milestoneIcon: string;
}

interface CalendarMilestone {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface CalendarTeamDuration {
  id: string;
  milestoneId: string;
  teamId: string;
  duration: number;
  startDate: string;
  endDate: string;
}

export interface CalendarTeam {
  id: string;
  name: string;
  color: string;
}

/** Parse a date to local midnight, avoiding timezone shifts */
function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(year, month, day);
}

const STATUS_DOT_COLORS: Record<string, string> = {
  not_started: "#94a3b8", // slate-400
  in_progress: "#3b82f6", // blue-500
  on_hold: "#f59e0b",     // amber-500
  completed: "#22c55e",   // green-500
  cancelled: "#ef4444",   // red-500
};

/**
 * Derive event colors from a milestone hex color.
 * Returns a slightly transparent background with a solid border.
 */
function milestoneColorToEventColors(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    borderColor: hex,
    textColor: "var(--foreground)",
  };
}

/** Greyed-out colors for completed / cancelled features. */
function doneEventColors() {
  return {
    backgroundColor: "var(--muted)",
    borderColor: "var(--border)",
    textColor: "var(--muted-foreground)",
  };
}

/**
 * Derive team track event colors from a team hex color.
 * Slightly more opaque than feature bars to differentiate.
 */
function teamColorToEventColors(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
    borderColor: hex,
    textColor: "var(--foreground)",
  };
}

/**
 * Convert features + team tracks to FullCalendar EventInput[].
 *
 * Produces two kinds of events:
 * 1. Feature bars — individual feature date ranges with milestone label baked in.
 * 2. Team track bars — per-team durations within a feature, order 1 (below features).
 *
 * Milestone identity is shown inline on each feature (colored dot + name prefix)
 * rather than as a separate spanning event.
 *
 * FullCalendar uses exclusive end dates → addDays(inclusiveEnd, 1).
 */
export function featuresToCalendarEvents(
  features: CalendarFeature[],
  _milestones: CalendarMilestone[],
  teamDurations: CalendarTeamDuration[] = [],
  teams: CalendarTeam[] = [],
): EventInput[] {
  const events: EventInput[] = [];

  // Feature bars
  const featureById = new Map(features.map((f) => [f.id, f]));
  for (const f of features) {
    const start = toLocalMidnight(f.startDate);
    const end = addDays(toLocalMidnight(f.endDate), 1);
    const done = f.status === "completed" || f.status === "cancelled";
    const colors = done
      ? doneEventColors()
      : milestoneColorToEventColors(f.milestoneColor);

    events.push({
      id: f.id,
      title: f.title,
      start,
      end,
      allDay: true,
      ...colors,
      ...(done && { classNames: ["calendar-event-done"] }),
      extendedProps: {
        featureId: f.id,
        projectId: f.projectId,
        status: f.status,
        priority: f.priority,
        progress: f.progress,
        duration: f.duration,
        milestoneName: f.milestoneName,
        milestoneColor: f.milestoneColor,
        milestoneIcon: f.milestoneIcon,
        statusDotColor: STATUS_DOT_COLORS[f.status] ?? STATUS_DOT_COLORS.not_started,
      },
    });
  }

  // Team track bars
  if (teamDurations.length > 0 && teams.length > 0) {
    const teamsById = new Map(teams.map((t) => [t.id, t]));

    for (const td of teamDurations) {
      const team = teamsById.get(td.teamId);
      const feature = featureById.get(td.milestoneId);
      if (!team || !feature) continue;

      const start = toLocalMidnight(td.startDate);
      const end = addDays(toLocalMidnight(td.endDate), 1);
      const featureDone = feature.status === "completed" || feature.status === "cancelled";
      const colors = featureDone
        ? doneEventColors()
        : teamColorToEventColors(team.color);

      events.push({
        id: `team-${td.id}`,
        title: `${team.name} · ${feature.title}`,
        start,
        end,
        allDay: true,
        ...colors,
        ...(featureDone && { classNames: ["calendar-event-done"] }),
        order: 1,
        extendedProps: {
          isTeamTrack: true,
          teamId: td.teamId,
          teamName: team.name,
          teamColor: team.color,
          featureId: td.milestoneId,
          projectId: feature.projectId,
          duration: td.duration,
        },
      });
    }
  }

  return events;
}
