'use client';

import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
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
    },
    ref
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollLeftRef = useRef(0);
    const columnsRef = useRef<HTMLDivElement>(null);

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
      // Sync dashed column lines (horizontal only)
      if (columnsRef.current) {
        columnsRef.current.style.backgroundPositionX = `-${el.scrollLeft}px`;
      }
      onScroll?.(el.scrollLeft, el.scrollTop);
    }, [onScroll]);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

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
        {/* Scroll area wrapper — contains fixed column overlay + scrollable content */}
        <div className="timeline-scroll-wrapper" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {/* Dashed column lines — stays fixed vertically, syncs horizontally via scroll handler */}
          <div
            ref={columnsRef}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                repeating-linear-gradient(
                  to right,
                  transparent 0px,
                  transparent ${cellWidth - 1}px,
                  var(--border) ${cellWidth - 1}px,
                  var(--border) ${cellWidth}px
                )
              `,
              backgroundSize: `${cellWidth}px 100%`,
              maskImage: 'repeating-linear-gradient(to bottom, black 0px 3px, transparent 3px 6px)',
              WebkitMaskImage: 'repeating-linear-gradient(to bottom, black 0px 3px, transparent 3px 6px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          {/* Scrollable content */}
          <div
            ref={scrollRef}
            className="timeline-scroll-area"
            style={{ overflow: 'auto', position: 'absolute', inset: 0, zIndex: 1 }}
          >
            <div style={{ width: totalWidth, height: visibleRowCount * ROW_HEIGHT, minHeight: '100%', position: 'relative', overflow: 'hidden', transition: 'height 200ms ease' }}>
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
