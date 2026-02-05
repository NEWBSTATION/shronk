import { format, endOfWeek } from 'date-fns';
import type { TimePeriod } from './types';
import type { IScaleConfig } from '@svar-ui/react-gantt';

/**
 * Scale configurations for each time period
 * Replicates the existing label format from the custom implementation
 */
export const SCALE_CONFIGS: Record<TimePeriod, IScaleConfig[]> = {
  week: [
    {
      unit: 'week',
      step: 1,
      format: (date: Date) => {
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        return `${format(date, 'MMM d')}-${format(weekEnd, 'd')} W${format(date, 'w')}`;
      },
    },
    {
      unit: 'day',
      step: 1,
      format: (date: Date) => `${format(date, 'EEEEE')} ${format(date, 'd')}`, // "Su 25"
    },
  ],
  month: [
    {
      unit: 'month',
      step: 1,
      format: (date: Date) => `${format(date, 'MMM')} ${format(date, 'yyyy')}`,
    },
    {
      unit: 'week',
      step: 1,
      format: (date: Date) => {
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        return `${format(date, 'd')}-${format(weekEnd, 'd')}`; // "1-7"
      },
    },
  ],
  quarter: [
    {
      unit: 'quarter',
      step: 1,
      format: (date: Date) => `Q${format(date, 'Q')} ${format(date, 'yyyy')}`,
    },
    {
      unit: 'month',
      step: 1,
      format: 'MMM',
    },
  ],
  year: [
    {
      unit: 'year',
      step: 1,
      format: 'yyyy',
    },
    {
      unit: 'quarter',
      step: 1,
      format: (date: Date) => `Q${format(date, 'Q')}`,
    },
  ],
};

/**
 * Returns scale configs adapted to the current cellWidth.
 * For the week period, drops the day-of-week letter when cells are too narrow.
 */
export function getScaleConfig(timePeriod: TimePeriod, cellWidth: number): IScaleConfig[] {
  const base = SCALE_CONFIGS[timePeriod];

  if (timePeriod === 'week' && cellWidth < 45) {
    return [
      base[0],
      {
        ...base[1],
        format: (date: Date) => format(date, 'd'),
      },
    ];
  }

  return base;
}

/**
 * Calculate cell width based on zoom level and time period
 * Maps zoom levels 1-9 to appropriate pixel widths
 */
export function calculateCellWidth(zoomLevel: number, timePeriod: TimePeriod): number {
  // Min and max cell widths for each time period
  const cellWidthRanges: Record<TimePeriod, { min: number; max: number }> = {
    week: { min: 25, max: 105 },      // Day cells
    month: { min: 70, max: 160 },     // Week cells
    quarter: { min: 80, max: 215 },   // Month cells
    year: { min: 80, max: 215 },      // Quarter cells
  };

  const { min, max } = cellWidthRanges[timePeriod];
  // Normalize zoom level 1-9 to 0-1
  const t = (zoomLevel - 1) / 8;
  return min + (max - min) * t;
}

/**
 * Get row height for the Gantt chart
 */
export const ROW_HEIGHT = 52;

/**
 * Get header height for the Gantt chart
 */
export const SCALE_HEIGHT = 56;
