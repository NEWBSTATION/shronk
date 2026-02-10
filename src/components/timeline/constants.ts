import type { TimePeriod, TimePeriodConfig, StatusConfig } from './types';
import type { MilestoneStatus, MilestonePriority } from '@/db/schema';

// Layout constants
export const ROW_HEIGHT = 52;
export const HEADER_HEIGHT = 56;
export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 0;

// Zoom constants (9 levels = 8 steps between min and max)
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 9;
export const ZOOM_DEFAULT = 5;

// Interaction constants
export const RESIZE_HANDLE_WIDTH = 12;
export const CONNECTION_HANDLE_SIZE = 12;
export const MIN_BAR_WIDTH = 20;

// Time period configuration (matches ClickUp Gantt)
// subColumnWidth = width of smallest unit at each zoom level
// Week: sub-column = day (25-105px)
// Month: sub-column = week (70-160px)
// Quarter: sub-column = month (80-215px)
// Year: sub-column = quarter (80-215px)
export const TIME_PERIOD_CONFIG: Record<TimePeriod, TimePeriodConfig> = {
  week: {
    minSubColumnWidth: 25,
    maxSubColumnWidth: 105,
    daysPerSubColumn: 1,  // 1 day per sub-column
  },
  month: {
    minSubColumnWidth: 70,
    maxSubColumnWidth: 160,
    daysPerSubColumn: 7,  // 1 week per sub-column
  },
  quarter: {
    minSubColumnWidth: 80,
    maxSubColumnWidth: 215,
    daysPerSubColumn: 30.44,  // ~1 month per sub-column
  },
  year: {
    minSubColumnWidth: 80,
    maxSubColumnWidth: 215,
    daysPerSubColumn: 91.31,  // ~1 quarter per sub-column
  },
};

// Status configuration with theme-aware CSS variables
export const STATUS_CONFIG: Record<MilestoneStatus, StatusConfig> = {
  not_started: {
    bgColor: 'var(--status-not-started)',
    textColor: 'var(--status-not-started-foreground)',
    label: 'Not Started',
  },
  in_progress: {
    bgColor: 'var(--status-in-progress)',
    textColor: 'var(--status-in-progress-foreground)',
    label: 'In Progress',
  },
  on_hold: {
    bgColor: 'var(--status-on-hold)',
    textColor: 'var(--status-on-hold-foreground)',
    label: 'On Hold',
  },
  completed: {
    bgColor: 'var(--status-completed)',
    textColor: 'var(--status-completed-foreground)',
    label: 'Completed',
  },
  cancelled: {
    bgColor: 'var(--status-cancelled)',
    textColor: 'var(--status-cancelled-foreground)',
    label: 'Cancelled',
  },
};

// Priority configuration with theme-aware CSS variables
export const PRIORITY_CONFIG: Record<MilestonePriority, { label: string; color: string }> = {
  low: {
    label: 'Low',
    color: 'var(--priority-low)',
  },
  medium: {
    label: 'Medium',
    color: 'var(--priority-medium)',
  },
  high: {
    label: 'High',
    color: 'var(--priority-high)',
  },
  critical: {
    label: 'Critical',
    color: 'var(--priority-critical)',
  },
};

// Milestone marker color
export const MILESTONE_COLOR = 'var(--accent)';

// Fixed timeline range (available date range for all date selection)
export const TIMELINE_START_DATE = new Date(2024, 0, 1); // Jan 1, 2024
export const TIMELINE_END_DATE = new Date(2030, 11, 31);  // Dec 31, 2030
