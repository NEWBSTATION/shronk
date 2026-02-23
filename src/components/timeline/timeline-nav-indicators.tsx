'use client';

import { useLayoutEffect, useRef, useCallback, type RefObject } from 'react';
import { format } from 'date-fns';
import { dateToPixel, durationToPixels } from './date-math';
import { ROW_HEIGHT } from './scales-config';
import type { TimelineTask } from './types';

const BUTTON_SIZE = 24;
const EDGE_INSET = 6;

interface TimelineNavIndicatorsProps {
  tasks: TimelineTask[];
  pixelsPerDay: number;
  timelineStart: Date;
  scrollRef: RefObject<HTMLDivElement | null>;
  hideTeamTracks?: boolean;
}

interface IndicatorInfo {
  taskId: string;
  direction: 'left' | 'right';
  rowTop: number;
  startDate: Date;
}

export function TimelineNavIndicators({
  tasks,
  pixelsPerDay,
  timelineStart,
  scrollRef,
  hideTeamTracks,
}: TimelineNavIndicatorsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  // Store latest props in refs so the rAF loop always reads current values
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const pixelsPerDayRef = useRef(pixelsPerDay);
  pixelsPerDayRef.current = pixelsPerDay;
  const timelineStartRef = useRef(timelineStart);
  timelineStartRef.current = timelineStart;
  const hideTeamTracksRef = useRef(hideTeamTracks);
  hideTeamTracksRef.current = hideTeamTracks;

  const computeIndicators = useCallback((scrollEl: HTMLDivElement): IndicatorInfo[] => {
    const currentTasks = tasksRef.current;
    const ppd = pixelsPerDayRef.current;
    const tlStart = timelineStartRef.current;
    const hideTracks = hideTeamTracksRef.current;

    const scrollLeft = scrollEl.scrollLeft;
    const viewportWidth = scrollEl.clientWidth;
    const scrollTop = scrollEl.scrollTop;
    const viewportRight = scrollLeft + viewportWidth;

    const result: IndicatorInfo[] = [];
    let rowIndex = 0;
    let adjustedRowIndex = 0;

    for (const task of currentTasks) {
      const isTeam = !!task.$custom?.isTeamTrack;

      // Skip team tracks and the add-feature sentinel
      if (isTeam || task.id === '__add_feature__') {
        rowIndex++;
        if (!isTeam) adjustedRowIndex++;
        continue;
      }

      const barLeft = dateToPixel(task.startDate, tlStart, ppd);
      const barWidth = durationToPixels(Math.max(1, task.duration), ppd);
      const barRight = barLeft + barWidth;
      const LABEL_BUFFER = 40;
      const visibleRight = barRight + LABEL_BUFFER;

      const effectiveRowIndex = hideTracks ? adjustedRowIndex : rowIndex;
      const rowTop = effectiveRowIndex * ROW_HEIGHT;

      // Check if bar + label area is completely off-screen
      if (visibleRight < scrollLeft) {
        result.push({
          taskId: task.id,
          direction: 'left',
          rowTop: rowTop - scrollTop,
          startDate: task.startDate,
        });
      } else if (barLeft > viewportRight) {
        result.push({
          taskId: task.id,
          direction: 'right',
          rowTop: rowTop - scrollTop,
          startDate: task.startDate,
        });
      }

      rowIndex++;
      adjustedRowIndex++;
    }

    return result;
  }, []);

  const scrollToTask = useCallback(
    (startDate: Date) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const targetX = dateToPixel(startDate, timelineStartRef.current, pixelsPerDayRef.current);
      const viewportWidth = scrollEl.clientWidth;
      scrollEl.scrollTo({
        left: Math.max(0, targetX - viewportWidth * 0.3),
        behavior: 'smooth',
      });
    },
    [scrollRef]
  );

  useLayoutEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    let mounted = true;
    let rafId: number;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'timeline-nav-tooltip';
    tooltip.style.display = 'none';
    wrapper.appendChild(tooltip);
    tooltipRef.current = tooltip;

    function showTooltipForEl(el: HTMLDivElement) {
      hoveredIdRef.current = `${el.dataset.taskId}-${el.dataset.direction}`;
      const dateStr = el.dataset.startDate;
      const dir = el.dataset.direction;
      if (!dateStr || !tooltip || !wrapper) return;

      try {
        const d = new Date(dateStr);
        const sameYear = d.getFullYear() === new Date().getFullYear();
        tooltip.textContent = format(d, sameYear ? 'MMM d' : 'MMM d, yyyy');
      } catch {
        tooltip.textContent = '';
      }
      tooltip.style.display = '';
      tooltip.style.opacity = '0';

      // Use fresh rects for positioning
      const btnRect = el.getBoundingClientRect();
      const wRect = wrapper.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();

      let tipLeft: number;
      if (dir === 'left') {
        tipLeft = btnRect.right + 6 - wRect.left;
      } else {
        tipLeft = btnRect.left - tipRect.width - 6 - wRect.left;
      }
      const tipTop = btnRect.top + btnRect.height / 2 - tipRect.height / 2 - wRect.top;

      tooltip.style.left = `${tipLeft}px`;
      tooltip.style.top = `${tipTop}px`;
      tooltip.style.opacity = '1';
    }

    function hideTooltipEl() {
      hoveredIdRef.current = null;
      if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.style.opacity = '0';
      }
    }

    function createIndicatorEl(direction: 'left' | 'right', taskId: string): HTMLDivElement {
      const el = document.createElement('div');
      el.className = 'timeline-nav-indicator';
      el.dataset.taskId = taskId;
      el.dataset.direction = direction;
      el.style.position = 'absolute';
      el.style.width = `${BUTTON_SIZE}px`;
      el.style.height = `${BUTTON_SIZE}px`;
      el.style.zIndex = '5';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.borderRadius = '6px';
      el.style.opacity = '0';
      el.style.transition = 'opacity 400ms ease, background-color 150ms ease';
      el.style.pointerEvents = 'none';
      // Delay reveal so indicators don't flash during quick scrolling
      el.dataset.revealAt = String(Date.now() + 300);

      // Add chevron SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6');
      svg.appendChild(path);
      el.appendChild(svg);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = el.dataset.startDate;
        if (dateStr) scrollToTask(new Date(dateStr));
      });

      el.addEventListener('mouseenter', () => showTooltipForEl(el));
      el.addEventListener('mouseleave', hideTooltipEl);

      wrapper!.appendChild(el);
      return el;
    }

    const tick = () => {
      if (!mounted) return;

      const scrollEl = scrollRef.current;
      if (!scrollEl) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const indicators = computeIndicators(scrollEl);
      const scrollRect = scrollEl.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const chartTop = scrollRect.top - wrapperRect.top;
      const chartHeight = scrollEl.clientHeight;
      const chartLeft = scrollRect.left - wrapperRect.left;
      // Use clientWidth to exclude the vertical scrollbar
      const chartWidth = scrollEl.clientWidth;

      const activeIds = new Set<string>();

      for (const ind of indicators) {
        const id = `${ind.taskId}-${ind.direction}`;
        activeIds.add(id);

        let el = indicatorsRef.current.get(id);
        if (!el) {
          el = createIndicatorEl(ind.direction, ind.taskId);
          indicatorsRef.current.set(id, el);
        }

        // Update start date for click/tooltip
        el.dataset.startDate = ind.startDate.toISOString();

        // Position
        const buttonTop = chartTop + ind.rowTop + (ROW_HEIGHT - BUTTON_SIZE) / 2;
        const buttonLeft =
          ind.direction === 'left'
            ? chartLeft + EDGE_INSET
            : chartLeft + chartWidth - BUTTON_SIZE - EDGE_INSET;

        // Hide if row is outside the visible chart area, or still within reveal delay
        const rowVisibleTop = ind.rowTop;
        const rowVisibleBottom = ind.rowTop + ROW_HEIGHT;
        const revealAt = Number(el.dataset.revealAt || 0);
        const ready = Date.now() >= revealAt;
        if (rowVisibleBottom < 0 || rowVisibleTop > chartHeight || !ready) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        } else {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
        }

        el.style.left = `${buttonLeft}px`;
        el.style.top = `${buttonTop}px`;
      }

      // Remove stale indicators
      for (const [id, el] of indicatorsRef.current) {
        if (!activeIds.has(id)) {
          el.remove();
          indicatorsRef.current.delete(id);
          if (hoveredIdRef.current === id) hideTooltipEl();
        }
      }

      // Update tooltip position if still hovered
      if (hoveredIdRef.current) {
        const hoveredEl = indicatorsRef.current.get(hoveredIdRef.current);
        if (hoveredEl && tooltip.style.display !== 'none') {
          showTooltipForEl(hoveredEl);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      for (const [, el] of indicatorsRef.current) el.remove();
      indicatorsRef.current.clear();
      tooltip.remove();
      tooltipRef.current = null;
    };
  }, [computeIndicators, scrollRef, scrollToTask]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'hidden',
      }}
    />
  );
}
