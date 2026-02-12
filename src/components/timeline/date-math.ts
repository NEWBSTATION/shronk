import { differenceInCalendarDays, addDays } from 'date-fns';
import { TIME_PERIOD_CONFIG } from './constants';
import type { TimePeriod } from './types';

/**
 * Get pixels-per-day for a given cell width and time period.
 * cellWidth = width of one sub-column (day/week/month/quarter),
 * so pixelsPerDay = cellWidth / daysPerSubColumn.
 */
export function getPixelsPerDay(cellWidth: number, timePeriod: TimePeriod): number {
  return cellWidth / TIME_PERIOD_CONFIG[timePeriod].daysPerSubColumn;
}

/**
 * Convert a date to an absolute pixel X position within the timeline.
 */
export function dateToPixel(date: Date, timelineStart: Date, pixelsPerDay: number): number {
  return differenceInCalendarDays(date, timelineStart) * pixelsPerDay;
}

/**
 * Convert an absolute pixel X position back to a date.
 */
export function pixelToDate(px: number, timelineStart: Date, pixelsPerDay: number): Date {
  return addDays(timelineStart, Math.round(px / pixelsPerDay));
}

/**
 * Convert a duration in days to pixel width.
 */
export function durationToPixels(durationDays: number, pixelsPerDay: number): number {
  return durationDays * pixelsPerDay;
}

/**
 * Get the total pixel width for a date range.
 */
export function getTotalWidth(windowStart: Date, windowEnd: Date, pixelsPerDay: number): number {
  return differenceInCalendarDays(windowEnd, windowStart) * pixelsPerDay;
}
