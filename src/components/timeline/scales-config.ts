import { format, endOfWeek, startOfDay, isEqual } from 'date-fns';
import { createElement } from 'react';
import type { TimePeriod } from './types';
import type { IScaleConfig } from '@svar-ui/react-gantt';

const todayBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '18px',
  height: '18px',
  borderRadius: '9px',
  backgroundColor: 'var(--destructive)',
  color: 'var(--destructive-foreground)',
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: 1,
  padding: '0 4px',
};

function isToday(date: Date): boolean {
  return isEqual(startOfDay(date), startOfDay(new Date()));
}

/**
 * Scale configurations for each time period
 * Replicates the existing label format from the custom implementation
 */
export const SCALE_CONFIGS: Record<TimePeriod, IScaleConfig[]> = {
  week: [
    {
      unit: 'week',
      step: 1,
      format: ((date: Date) => {
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        const dateRange = `${format(date, 'MMM d')}-${format(weekEnd, 'd')}`;
        const weekNum = `W${format(date, 'w')}`;
        return createElement(
          'span',
          { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
          createElement('span', null, dateRange),
          createElement('span', { style: { opacity: 0.5 } }, weekNum),
        );
      }) as unknown as IScaleConfig['format'],
    },
    {
      unit: 'day',
      step: 1,
      format: ((date: Date) => {
        const dayName = format(date, 'EEEEEE');
        const dayNum = format(date, 'd');
        if (isToday(date)) {
          return createElement(
            'span',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' } },
            createElement('span', null, dayName),
            createElement('span', { style: todayBadgeStyle }, dayNum),
          );
        }
        return `${dayName} ${dayNum}`;
      }) as unknown as IScaleConfig['format'],
    },
  ],
  month: [
    {
      unit: 'month',
      step: 1,
      format: ((date: Date) => {
        return createElement(
          'span',
          { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
          createElement('span', null, format(date, 'MMM')),
          createElement('span', { style: { opacity: 0.5 } }, format(date, 'yyyy')),
        );
      }) as unknown as IScaleConfig['format'],
    },
    {
      unit: 'week',
      step: 1,
      format: ((date: Date) => {
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        const dateRange = `${format(date, 'd')}-${format(weekEnd, 'd')}`;
        const weekNum = `W${format(date, 'w')}`;
        return createElement(
          'span',
          { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
          createElement('span', null, dateRange),
          createElement('span', { style: { opacity: 0.5 } }, weekNum),
        );
      }) as unknown as IScaleConfig['format'],
    },
  ],
  quarter: [
    {
      unit: 'quarter',
      step: 1,
      format: ((date: Date) => {
        return createElement(
          'span',
          { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
          createElement('span', null, `Q${format(date, 'Q')}`),
          createElement('span', { style: { opacity: 0.5 } }, format(date, 'yyyy')),
        );
      }) as unknown as IScaleConfig['format'],
    },
    {
      unit: 'month',
      step: 1,
      format: (date: Date) => format(date, 'MMM'),
    },
  ],
  year: [
    {
      unit: 'year',
      step: 1,
      format: (date: Date) => format(date, 'yyyy'),
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
        format: ((date: Date) => {
          const dayNum = format(date, 'd');
          if (isToday(date)) {
            return createElement('span', { style: todayBadgeStyle }, dayNum);
          }
          return dayNum;
        }) as unknown as IScaleConfig['format'],
      },
    ];
  }

  if (timePeriod === 'month' && cellWidth < 100) {
    return [
      base[0],
      {
        ...base[1],
        format: (date: Date) => {
          const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
          return `${format(date, 'd')}-${format(weekEnd, 'd')}`;
        },
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
export const SCALE_HEIGHT = 32;
