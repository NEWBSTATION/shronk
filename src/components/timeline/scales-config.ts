import { format, endOfWeek, startOfDay, isEqual } from 'date-fns';
import { createElement, type ReactNode } from 'react';

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

export function isToday(date: Date): boolean {
  return isEqual(startOfDay(date), startOfDay(new Date()));
}

export const ROW_HEIGHT = 52;
export const SCALE_HEIGHT = 32;

// ================================================
// Format helpers for timeline-scales.tsx
// ================================================

/** Week view — top row: "MMM d-d  Wxx" */
export function formatWeekTop(date: Date): ReactNode {
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  const dateRange = `${format(date, 'MMM d')}-${format(weekEnd, 'd')}`;
  const weekNum = `W${format(date, 'w')}`;
  return createElement(
    'span',
    { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
    createElement('span', null, dateRange),
    createElement('span', { style: { opacity: 0.5 } }, weekNum),
  );
}

/** Week view — bottom row: "Mo 5" or today badge */
export function formatDayBottom(date: Date, cellWidth: number): ReactNode {
  const dayNum = format(date, 'd');
  if (isToday(date)) {
    if (cellWidth < 45) {
      return createElement('span', { style: todayBadgeStyle }, dayNum);
    }
    return createElement(
      'span',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '100%' } },
      createElement('span', null, format(date, 'EEEEEE')),
      createElement('span', { style: todayBadgeStyle }, dayNum),
    );
  }
  if (cellWidth < 45) return dayNum;
  return `${format(date, 'EEEEEE')} ${dayNum}`;
}

/** Month view — top row: "MMM  yyyy" */
export function formatMonthTop(date: Date): ReactNode {
  return createElement(
    'span',
    { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
    createElement('span', null, format(date, 'MMM')),
    createElement('span', { style: { opacity: 0.5 } }, format(date, 'yyyy')),
  );
}

/** Month view — bottom row: "d-d  Wxx" */
export function formatWeekBottom(date: Date, cellWidth: number): ReactNode {
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  if (cellWidth < 100) {
    return `${format(date, 'd')}-${format(weekEnd, 'd')}`;
  }
  const dateRange = `${format(date, 'd')}-${format(weekEnd, 'd')}`;
  const weekNum = `W${format(date, 'w')}`;
  return createElement(
    'span',
    { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
    createElement('span', null, dateRange),
    createElement('span', { style: { opacity: 0.5 } }, weekNum),
  );
}

/** Quarter view — top row: "Q1  yyyy" */
export function formatQuarterTop(date: Date): ReactNode {
  return createElement(
    'span',
    { style: { display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' } },
    createElement('span', null, `Q${format(date, 'Q')}`),
    createElement('span', { style: { opacity: 0.5 } }, format(date, 'yyyy')),
  );
}

/** Quarter view — bottom row: "MMM" */
export function formatMonthBottom(date: Date): string {
  return format(date, 'MMM');
}

/** Year view — top row: "yyyy" */
export function formatYearTop(date: Date): string {
  return format(date, 'yyyy');
}

/** Year view — bottom row: "Q1" */
export function formatQuarterBottom(date: Date): string {
  return `Q${format(date, 'Q')}`;
}
