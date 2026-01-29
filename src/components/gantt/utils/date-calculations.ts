import {
  differenceInDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  format,
  isWeekend,
  isSameDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
} from "date-fns";
import type { TimePeriod } from "@/store/gantt-store";

export interface TimelineConfig {
  baseWidth: number;
  format: string;
  subFormat?: string;
}

export const TIME_PERIOD_CONFIG: Record<TimePeriod, TimelineConfig> = {
  day: { baseWidth: 40, format: "d", subFormat: "EEE" },
  week: { baseWidth: 100, format: "'W'w", subFormat: "MMM d" },
  month: { baseWidth: 120, format: "MMMM", subFormat: "yyyy" },
  quarter: { baseWidth: 180, format: "'Q'Q yyyy" },
  year: { baseWidth: 200, format: "yyyy" },
};

export function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getDayWidth(period: TimePeriod, zoom: number): number {
  const config = TIME_PERIOD_CONFIG[period];
  const daysInPeriod = getDaysInPeriod(period);
  return (config.baseWidth * zoom) / daysInPeriod;
}

function getDaysInPeriod(period: TimePeriod): number {
  switch (period) {
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
    case "quarter":
      return 90;
    case "year":
      return 365;
  }
}

export function getColumnWidth(period: TimePeriod, zoom: number): number {
  return TIME_PERIOD_CONFIG[period].baseWidth * zoom;
}

export interface TimelineRange {
  start: Date;
  end: Date;
  totalDays: number;
}

export function calculateTimelineRange(
  items: Array<{ startDate: Date | string; endDate: Date | string }>,
  period: TimePeriod,
  paddingPeriods: number = 2
): TimelineRange {
  if (items.length === 0) {
    const now = new Date();
    return {
      start: getPeriodStart(now, period),
      end: getPeriodEnd(addPeriods(now, period, 6), period),
      totalDays: getDaysInPeriod(period) * 6,
    };
  }

  let minDate = new Date(items[0].startDate);
  let maxDate = new Date(items[0].endDate);

  items.forEach((item) => {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
  });

  // Add padding
  const start = getPeriodStart(
    addPeriods(minDate, period, -paddingPeriods),
    period
  );
  const end = getPeriodEnd(addPeriods(maxDate, period, paddingPeriods), period);

  return {
    start,
    end,
    totalDays: differenceInDays(end, start) + 1,
  };
}

function getPeriodStart(date: Date, period: TimePeriod): Date {
  switch (period) {
    case "day":
      return startOfDay(date);
    case "week":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(date);
    case "quarter":
      return startOfQuarter(date);
    case "year":
      return startOfYear(date);
  }
}

function getPeriodEnd(date: Date, period: TimePeriod): Date {
  switch (period) {
    case "day":
      return endOfDay(date);
    case "week":
      return endOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return endOfMonth(date);
    case "quarter":
      return endOfQuarter(date);
    case "year":
      return endOfYear(date);
  }
}

function addPeriods(date: Date, period: TimePeriod, count: number): Date {
  switch (period) {
    case "day":
      return addDays(date, count);
    case "week":
      return addWeeks(date, count);
    case "month":
      return addMonths(date, count);
    case "quarter":
      return addQuarters(date, count);
    case "year":
      return addYears(date, count);
  }
}

export interface HeaderCell {
  date: Date;
  label: string;
  subLabel?: string;
  width: number;
  isToday?: boolean;
}

export function generateHeaderCells(
  range: TimelineRange,
  period: TimePeriod,
  zoom: number
): { primary: HeaderCell[]; secondary: HeaderCell[] } {
  const config = TIME_PERIOD_CONFIG[period];
  const columnWidth = getColumnWidth(period, zoom);
  const dayWidth = getDayWidth(period, zoom);
  const today = startOfDay(new Date());

  const primaryCells: HeaderCell[] = [];
  const secondaryCells: HeaderCell[] = [];

  // Generate primary cells based on period
  let intervals: Date[];
  switch (period) {
    case "day":
      intervals = eachDayOfInterval({ start: range.start, end: range.end });
      break;
    case "week":
      intervals = eachWeekOfInterval(
        { start: range.start, end: range.end },
        { weekStartsOn: 1 }
      );
      break;
    case "month":
      intervals = eachMonthOfInterval({ start: range.start, end: range.end });
      break;
    case "quarter":
      intervals = eachQuarterOfInterval({ start: range.start, end: range.end });
      break;
    case "year":
      intervals = eachYearOfInterval({ start: range.start, end: range.end });
      break;
  }

  intervals.forEach((date) => {
    const isToday = isSameDay(date, today);
    primaryCells.push({
      date,
      label: format(date, config.format),
      width: columnWidth,
      isToday,
    });
  });

  // Generate secondary row for context
  if (period === "day") {
    // Show months above days
    const months = eachMonthOfInterval({ start: range.start, end: range.end });
    months.forEach((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const effectiveStart =
        monthStart < range.start ? range.start : monthStart;
      const effectiveEnd = monthEnd > range.end ? range.end : monthEnd;
      const days = differenceInDays(effectiveEnd, effectiveStart) + 1;

      secondaryCells.push({
        date: monthStart,
        label: format(monthStart, "MMMM yyyy"),
        width: days * dayWidth,
      });
    });
  } else if (period === "week") {
    // Show months above weeks
    const months = eachMonthOfInterval({ start: range.start, end: range.end });
    months.forEach((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const effectiveStart =
        monthStart < range.start ? range.start : monthStart;
      const effectiveEnd = monthEnd > range.end ? range.end : monthEnd;
      const days = differenceInDays(effectiveEnd, effectiveStart) + 1;

      secondaryCells.push({
        date: monthStart,
        label: format(monthStart, "MMMM yyyy"),
        width: days * dayWidth,
      });
    });
  } else if (period === "month") {
    // Show years above months
    const years = eachYearOfInterval({ start: range.start, end: range.end });
    years.forEach((yearStart) => {
      const yearEnd = endOfYear(yearStart);
      const effectiveStart = yearStart < range.start ? range.start : yearStart;
      const effectiveEnd = yearEnd > range.end ? range.end : yearEnd;
      const months = eachMonthOfInterval({
        start: effectiveStart,
        end: effectiveEnd,
      });

      secondaryCells.push({
        date: yearStart,
        label: format(yearStart, "yyyy"),
        width: months.length * columnWidth,
      });
    });
  }

  return { primary: primaryCells, secondary: secondaryCells };
}

export interface BarPosition {
  left: number;
  width: number;
  isSingleDay: boolean;
}

export function calculateBarPosition(
  startDate: Date | string,
  endDate: Date | string,
  timelineStart: Date,
  dayWidth: number
): BarPosition {
  const start = toLocalMidnight(startDate);
  const end = toLocalMidnight(endDate);

  const daysFromStart = differenceInDays(start, timelineStart);
  const duration = differenceInDays(end, start) + 1;

  const left = daysFromStart * dayWidth;
  const width = Math.max(duration * dayWidth, dayWidth);
  const isSingleDay = duration <= 1;

  return { left, width, isSingleDay };
}

export function dateFromPosition(
  position: number,
  timelineStart: Date,
  dayWidth: number
): Date {
  const days = Math.round(position / dayWidth);
  return addDays(timelineStart, days);
}

export function isWeekendDay(date: Date): boolean {
  return isWeekend(date);
}

export function getTodayPosition(
  timelineStart: Date,
  dayWidth: number
): number {
  const today = startOfDay(new Date());
  return differenceInDays(today, timelineStart) * dayWidth;
}
