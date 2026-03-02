'use client';

import { useMemo, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
} from 'date-fns';
import { TimelineScales } from './timeline-scales';
import { TimelineBars } from './timeline-bars';
import { TimelineLinks } from './timeline-links';
import { AddFeatureChartRow, type ChainInfo } from './add-feature-chart-row';
import { ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import { dateToPixel, getTotalWidth } from './date-math';
import type { TimePeriod, TimelineTask, TimelineLink } from './types';

interface WeekendColumnsProps {
  windowStart: Date;
  windowEnd: Date;
  pixelsPerDay: number;
  timePeriod: TimePeriod;
}

function WeekendColumns({ windowStart, windowEnd, pixelsPerDay, timePeriod }: WeekendColumnsProps) {
  if (timePeriod !== 'week') return null;

  const columns: Array<{ left: number; width: number; key: string; isSaturday: boolean }> = [];
  const cursor = new Date(windowStart);
  const end = windowEnd;

  while (cursor < end) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      const left = dateToPixel(cursor, windowStart, pixelsPerDay);
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      const width = dateToPixel(nextDay, windowStart, pixelsPerDay) - left;
      columns.push({ left, width, key: cursor.toISOString(), isSaturday: day === 6 });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return (
    <>
      {columns.map((col) => (
        <div
          key={col.key}
          className="timeline-weekend-column"
          style={{
            position: 'absolute',
            left: col.left,
            top: 0,
            bottom: 0,
            width: col.width,
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              color-mix(in srgb, var(--muted-foreground) 13%, transparent) 0px,
              color-mix(in srgb, var(--muted-foreground) 13%, transparent) 1.5px,
              transparent 1.5px,
              transparent 5px,
              color-mix(in srgb, var(--muted-foreground) 10%, transparent) 5px,
              color-mix(in srgb, var(--muted-foreground) 10%, transparent) 7px,
              transparent 7px,
              transparent 11px,
              color-mix(in srgb, var(--muted-foreground) 13%, transparent) 11px,
              color-mix(in srgb, var(--muted-foreground) 13%, transparent) 12.5px,
              transparent 12.5px,
              transparent 16px,
              color-mix(in srgb, var(--muted-foreground) 10%, transparent) 16px,
              color-mix(in srgb, var(--muted-foreground) 10%, transparent) 19px,
              transparent 19px,
              transparent 24px
            )`,
            borderRight: col.isSaturday ? '1px solid var(--border)' : 'none',
            willChange: 'transform',
          }}
        />
      ))}
    </>
  );
}

interface GridColumnsProps {
  windowStart: Date;
  windowEnd: Date;
  pixelsPerDay: number;
  timePeriod: TimePeriod;
}

function GridColumns({ windowStart, windowEnd, pixelsPerDay, timePeriod }: GridColumnsProps) {
  const lines = useMemo(() => {
    const result: Array<{ left: number; key: string }> = [];

    let cursor: Date;
    let advance: (d: Date) => Date;

    switch (timePeriod) {
      case 'week':
        // Every day boundary
        cursor = new Date(windowStart);
        advance = (d) => addDays(d, 1);
        break;
      case 'month':
        // Every week-start boundary
        cursor = startOfWeek(windowStart, { weekStartsOn: 0 });
        advance = (d) => addWeeks(d, 1);
        break;
      case 'quarter':
        // Every month-start boundary
        cursor = startOfMonth(windowStart);
        advance = (d) => addMonths(d, 1);
        break;
      case 'year':
        // Every quarter-start boundary
        cursor = startOfQuarter(windowStart);
        advance = (d) => addQuarters(d, 1);
        break;
    }

    while (cursor < windowEnd) {
      const left = dateToPixel(cursor, windowStart, pixelsPerDay);
      if (left > 0) {
        result.push({ left, key: cursor.toISOString() });
      }
      cursor = advance(cursor);
    }

    return result;
  }, [windowStart, windowEnd, pixelsPerDay, timePeriod]);

  return (
    <>
      {lines.map((line) => (
        <div
          key={line.key}
          style={{
            position: 'absolute',
            left: line.left - 1,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--border)',
            maskImage: 'repeating-linear-gradient(to bottom, black 0px 3px, transparent 3px 6px)',
            WebkitMaskImage: 'repeating-linear-gradient(to bottom, black 0px 3px, transparent 3px 6px)',
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

export interface TimelineChartHandle {
  scrollRef: HTMLDivElement | null;
  scrollTo: (left: number) => void;
}

interface TimelineChartProps {
  tasks: TimelineTask[];
  links: TimelineLink[];
  windowStart: Date;
  windowEnd: Date;
  cellWidth: number;
  timePeriod: TimePeriod;
  pixelsPerDay: number;
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskContextMenu?: (taskId: string, e: MouseEvent) => void;
  addFeatureRowIndex?: number;
  onQuickCreate?: (name: string, startDate: Date, endDate: Date, duration: number, chainToId?: string) => Promise<void>;
  chainInfo?: ChainInfo | null;
  hideTeamTracks?: boolean;
  searchMatchIds?: Set<string> | null;
  selectedIds?: Set<string>;
  focusedFeatureId?: string | null;
}

export const TimelineChart = forwardRef<TimelineChartHandle, TimelineChartProps>(
  function TimelineChart(
    {
      tasks,
      links,
      windowStart,
      windowEnd,
      cellWidth,
      timePeriod,
      pixelsPerDay,
      onScroll,
      onTaskClick,
      onTaskContextMenu,
      addFeatureRowIndex,
      onQuickCreate,
      chainInfo,
      hideTeamTracks,
      searchMatchIds,
      selectedIds,
      focusedFeatureId,
    },
    ref
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollLeftRef = useRef(0);

    useImperativeHandle(ref, () => ({
      get scrollRef() {
        return scrollRef.current;
      },
      scrollTo(left: number) {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = left;
        }
      },
    }));

    const totalWidth = getTotalWidth(windowStart, windowEnd, pixelsPerDay);
    const visibleRowCount = hideTeamTracks
      ? tasks.filter(t => !t.$custom?.isTeamTrack).length
      : tasks.length;

    const handleScroll = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      scrollLeftRef.current = el.scrollLeft;
      // Sync scale headers (scales are sibling of the wrapper div, two levels up)
      const chartEl = el.parentElement?.parentElement;
      const scalesEl = chartEl?.querySelector('.timeline-scales') as HTMLElement;
      if (scalesEl) {
        const inner = scalesEl.firstChild as HTMLElement;
        if (inner) inner.style.transform = `translateX(-${el.scrollLeft}px)`;
      }
      onScroll?.(el.scrollLeft, el.scrollTop);
    }, [onScroll]);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Measure scrollbar height and expose as CSS variable for the fade overlay
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const wrapper = el.closest('.timeline-scroll-wrapper') as HTMLElement | null;
      if (!wrapper) return;
      const update = () => {
        const scrollbarH = el.offsetHeight - el.clientHeight;
        wrapper.style.setProperty('--scrollbar-height', `${scrollbarH}px`);
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    // Lock scroll axis: suppress vertical scroll when gesture is primarily horizontal
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          el.scrollLeft += e.deltaX;
        }
      };
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    return (
      <div className="timeline-chart" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <TimelineScales
          scrollLeft={scrollLeftRef.current}
          windowStart={windowStart}
          windowEnd={windowEnd}
          cellWidth={cellWidth}
          timePeriod={timePeriod}
          pixelsPerDay={pixelsPerDay}
          totalWidth={totalWidth}
        />
        {/* Scroll area wrapper */}
        <div className="timeline-scroll-wrapper" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {/* Scrollable content */}
          <div
            ref={scrollRef}
            className="timeline-scroll-area"
            style={{ overflow: 'auto', position: 'absolute', inset: 0, zIndex: 1 }}
          >
            <div style={{ width: totalWidth, height: (visibleRowCount + 4) * ROW_HEIGHT, minHeight: '100%', position: 'relative', overflow: 'hidden', transition: 'height 200ms ease' }}>
              {/* Calendar-aligned grid lines */}
              <GridColumns
                windowStart={windowStart}
                windowEnd={windowEnd}
                pixelsPerDay={pixelsPerDay}
                timePeriod={timePeriod}
              />

              {/* Selected row highlights */}
              {selectedIds && selectedIds.size > 0 && tasks.map((task, i) => {
                if (!task.$custom?.isTeamTrack && selectedIds.has(task.id)) {
                  return (
                    <div
                      key={`sel-${task.id}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: i * ROW_HEIGHT,
                        height: ROW_HEIGHT,
                        backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                }
                return null;
              })}

              {/* Weekend columns */}
              <WeekendColumns
                windowStart={windowStart}
                windowEnd={windowEnd}
                pixelsPerDay={pixelsPerDay}
                timePeriod={timePeriod}
              />

              {/* Dependency lines (behind bars) */}
              <TimelineLinks
                tasks={tasks}
                links={links}
                pixelsPerDay={pixelsPerDay}
                timelineStart={windowStart}
                hideTeamTracks={hideTeamTracks}
                focusedFeatureId={focusedFeatureId}
              />

              {/* Task bars (on top of links) */}
              <TimelineBars
                tasks={tasks}
                pixelsPerDay={pixelsPerDay}
                timelineStart={windowStart}
                onTaskClick={onTaskClick}
                onTaskContextMenu={onTaskContextMenu}
                hideTeamTracks={hideTeamTracks}
                searchMatchIds={searchMatchIds}
                focusedFeatureId={focusedFeatureId}
              />

              {/* Quick-create overlay on the add-feature row */}
              {addFeatureRowIndex != null && onQuickCreate && (
                <AddFeatureChartRow
                  rowIndex={addFeatureRowIndex}
                  totalWidth={totalWidth}
                  pixelsPerDay={pixelsPerDay}
                  timelineStart={windowStart}
                  chainInfo={chainInfo}
                  onQuickCreate={onQuickCreate}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
