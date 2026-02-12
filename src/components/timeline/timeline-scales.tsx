'use client';

import { useMemo, type ReactNode } from 'react';
import {
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  differenceInCalendarDays,
} from 'date-fns';
import { dateToPixel } from './date-math';
import {
  SCALE_HEIGHT,
  formatWeekTop,
  formatDayBottom,
  formatMonthTop,
  formatWeekBottom,
  formatQuarterTop,
  formatMonthBottom,
  formatYearTop,
  formatQuarterBottom,
} from './scales-config';
import type { TimePeriod } from './types';

interface ScaleCell {
  key: string;
  left: number;
  width: number;
  content: ReactNode;
  isWeekend?: boolean;
}

interface TimelineScalesProps {
  scrollLeft: number;
  windowStart: Date;
  windowEnd: Date;
  cellWidth: number;
  timePeriod: TimePeriod;
  pixelsPerDay: number;
  totalWidth: number;
}

/** Generate scale cells for the top row */
function generateTopCells(
  windowStart: Date,
  windowEnd: Date,
  pixelsPerDay: number,
  timePeriod: TimePeriod,
): ScaleCell[] {
  const cells: ScaleCell[] = [];
  const endLimit = windowEnd;

  let cursor: Date;
  let advance: (d: Date) => Date;
  let formatFn: (d: Date) => ReactNode;

  switch (timePeriod) {
    case 'week':
      cursor = startOfWeek(windowStart, { weekStartsOn: 0 });
      advance = (d) => addWeeks(d, 1);
      formatFn = formatWeekTop;
      break;
    case 'month':
      cursor = startOfMonth(windowStart);
      advance = (d) => addMonths(d, 1);
      formatFn = formatMonthTop;
      break;
    case 'quarter':
      cursor = startOfQuarter(windowStart);
      advance = (d) => addQuarters(d, 1);
      formatFn = formatQuarterTop;
      break;
    case 'year':
      cursor = startOfYear(windowStart);
      advance = (d) => addYears(d, 1);
      formatFn = formatYearTop;
      break;
  }

  while (cursor < endLimit) {
    const next = advance(cursor);
    const left = dateToPixel(cursor, windowStart, pixelsPerDay);
    const right = dateToPixel(next, windowStart, pixelsPerDay);
    cells.push({
      key: cursor.toISOString(),
      left,
      width: right - left,
      content: formatFn(cursor),
    });
    cursor = next;
  }

  return cells;
}

/** Generate scale cells for the bottom row */
function generateBottomCells(
  windowStart: Date,
  windowEnd: Date,
  pixelsPerDay: number,
  timePeriod: TimePeriod,
  cellWidth: number,
): ScaleCell[] {
  const cells: ScaleCell[] = [];
  const endLimit = windowEnd;

  let cursor: Date;
  let advance: (d: Date) => Date;
  let formatFn: (d: Date) => ReactNode;

  switch (timePeriod) {
    case 'week':
      // Bottom = days
      cursor = new Date(windowStart);
      advance = (d) => addDays(d, 1);
      formatFn = (d) => formatDayBottom(d, cellWidth);
      break;
    case 'month':
      // Bottom = weeks
      cursor = startOfWeek(windowStart, { weekStartsOn: 0 });
      advance = (d) => addWeeks(d, 1);
      formatFn = (d) => formatWeekBottom(d, cellWidth);
      break;
    case 'quarter':
      // Bottom = months
      cursor = startOfMonth(windowStart);
      advance = (d) => addMonths(d, 1);
      formatFn = formatMonthBottom;
      break;
    case 'year':
      // Bottom = quarters
      cursor = startOfQuarter(windowStart);
      advance = (d) => addQuarters(d, 1);
      formatFn = formatQuarterBottom;
      break;
  }

  while (cursor < endLimit) {
    const next = advance(cursor);
    const left = dateToPixel(cursor, windowStart, pixelsPerDay);
    const right = dateToPixel(next, windowStart, pixelsPerDay);
    const day = cursor.getDay();
    cells.push({
      key: cursor.toISOString(),
      left,
      width: right - left,
      content: formatFn(cursor),
      isWeekend: timePeriod === 'week' && (day === 0 || day === 6),
    });
    cursor = next;
  }

  return cells;
}

export function TimelineScales({
  scrollLeft,
  windowStart,
  windowEnd,
  cellWidth,
  timePeriod,
  pixelsPerDay,
  totalWidth,
}: TimelineScalesProps) {
  const topCells = useMemo(
    () => generateTopCells(windowStart, windowEnd, pixelsPerDay, timePeriod),
    [windowStart, windowEnd, pixelsPerDay, timePeriod]
  );

  const bottomCells = useMemo(
    () => generateBottomCells(windowStart, windowEnd, pixelsPerDay, timePeriod, cellWidth),
    [windowStart, windowEnd, pixelsPerDay, timePeriod, cellWidth]
  );

  return (
    <div
      className="timeline-scales"
      style={{ height: SCALE_HEIGHT * 2, overflow: 'hidden', flexShrink: 0 }}
    >
      <div style={{ width: totalWidth, transform: `translateX(-${scrollLeft}px)` }}>
        {/* Top row */}
        <div className="timeline-scale-row" style={{ height: SCALE_HEIGHT, position: 'relative' }}>
          {topCells.map((cell) => (
            <div
              key={cell.key}
              className="timeline-scale-cell"
              style={{
                position: 'absolute',
                left: cell.left,
                width: cell.width,
                height: SCALE_HEIGHT,
              }}
            >
              {cell.content}
            </div>
          ))}
        </div>
        {/* Bottom row */}
        <div className="timeline-scale-row" style={{ height: SCALE_HEIGHT, position: 'relative' }}>
          {bottomCells.map((cell) => (
            <div
              key={cell.key}
              className={`timeline-scale-cell${cell.isWeekend ? ' timeline-scale-weekend' : ''}`}
              style={{
                position: 'absolute',
                left: cell.left,
                width: cell.width,
                height: SCALE_HEIGHT,
              }}
            >
              {cell.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
