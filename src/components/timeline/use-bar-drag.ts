import { useEffect, useRef, type RefObject, type MutableRefObject } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { dateToPixel, pixelToDate, durationToPixels } from './date-math';
import type { TimePeriod } from './types';
import { parseTeamTrackId } from './transformers';
import { roundedPath } from './timeline-links';
import { ROW_HEIGHT } from './scales-config';
import { reflowProject, type ReflowMilestone, type ReflowDependency } from '@/lib/reflow';
import type { Milestone } from '@/db/schema';
import type { TimelineTask } from './types';

type DragType = 'move' | 'resize-start' | 'resize-end';

interface UseBarDragOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  pixelsPerDayRef: MutableRefObject<number>;
  timelineStartRef: MutableRefObject<Date>;
  timePeriodRef: MutableRefObject<TimePeriod>;
  featureMapRef: MutableRefObject<Map<string, Milestone>>;
  predecessorMapRef: MutableRefObject<Map<string, string[]>>;
  reflowMilestonesRef: MutableRefObject<ReflowMilestone[]>;
  reflowDepsRef: MutableRefObject<ReflowDependency[]>;
  tasksRef: MutableRefObject<TimelineTask[]>;
  onDragEnd: (
    taskId: string,
    startDate: Date,
    endDate: Date,
    duration: number,
    isTeamTrack: boolean,
    teamTrack: { milestoneId: string; teamId: string } | null
  ) => void;
  onTaskClick: (taskId: string) => void;
  sentinelId: string;
}

export function useBarDrag({
  containerRef,
  pixelsPerDayRef,
  timelineStartRef,
  timePeriodRef,
  featureMapRef,
  predecessorMapRef,
  reflowMilestonesRef,
  reflowDepsRef,
  tasksRef,
  onDragEnd,
  onTaskClick,
  sentinelId,
}: UseBarDragOptions) {
  const isDraggingRef = useRef(false);
  const justDraggedRef = useRef(false);
  const dragTypeRef = useRef<DragType | null>(null);
  const dragTaskIdRef = useRef<string | null>(null);
  const startMouseXRef = useRef(0);
  const origLeftRef = useRef(0);
  const origWidthRef = useRef(0);
  const barElRef = useRef<HTMLElement | null>(null);
  const hasMovedRef = useRef(false);
  // Cascade tracking
  const cascadeOriginalsRef = useRef<Map<string, { left: number; width: number }>>(new Map());
  const lastCascadeKeyRef = useRef('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const DRAG_THRESHOLD = 3;
    let highlightEl: HTMLElement | null = null;

    function getBarElement(el: HTMLElement): HTMLElement | null {
      let cur: HTMLElement | null = el;
      while (cur && cur !== container) {
        if (cur.classList.contains('timeline-bar')) return cur;
        cur = cur.parentElement;
      }
      return null;
    }

    function getDragType(target: HTMLElement): DragType | null {
      if (target.classList.contains('timeline-bar-handle-left')) return 'resize-start';
      if (target.classList.contains('timeline-bar-handle-right')) return 'resize-end';
      if (target.classList.contains('timeline-connect-handle') ||
          target.classList.contains('timeline-connect-handle-left') ||
          target.classList.contains('timeline-connect-handle-right')) return null;
      return 'move';
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;

      // Skip if clicking on connection handle (drag-link uses those)
      if (target.classList.contains('timeline-connect-handle') ||
          target.classList.contains('timeline-connect-handle-left') ||
          target.classList.contains('timeline-connect-handle-right')) return;

      const barEl = getBarElement(target);
      if (!barEl) return;

      const taskId = barEl.getAttribute('data-task-id');
      if (!taskId || taskId === sentinelId) return;

      const dragType = getDragType(target);
      if (!dragType) return;

      // Check constraints
      const isChained = (predecessorMapRef.current.get(taskId) || []).length > 0;
      const teamTrack = parseTeamTrackId(taskId);

      // Chained features can only resize-end
      if (isChained && !teamTrack && dragType !== 'resize-end') return;

      e.preventDefault();

      dragTypeRef.current = dragType;
      dragTaskIdRef.current = taskId;
      barElRef.current = barEl;
      startMouseXRef.current = e.clientX;
      origLeftRef.current = parseFloat(barEl.style.left) || 0;
      origWidthRef.current = parseFloat(barEl.style.width) || 0;
      hasMovedRef.current = false;
      cascadeOriginalsRef.current.clear();
      lastCascadeKeyRef.current = '';

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e: PointerEvent) {
      const barEl = barElRef.current;
      if (!barEl || !dragTypeRef.current || !dragTaskIdRef.current) return;

      const dx = e.clientX - startMouseXRef.current;

      if (!hasMovedRef.current) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        hasMovedRef.current = true;
        isDraggingRef.current = true;
        barEl.classList.add('timeline-bar-dragging');

        // Highlight connected dependency links for the duration of the drag
        const svg = container!.querySelector('.timeline-links-overlay');
        if (svg) {
          const taskId = dragTaskIdRef.current!;
          svg.querySelectorAll(`[data-link-source="${taskId}"], [data-link-target="${taskId}"]`)
            .forEach((g) => g.classList.add('link-highlight', 'link-highlight-drag'));
        }

        // Create full-height highlight column behind the bar
        const contentEl = container!.querySelector('.timeline-scroll-area > div') as HTMLElement | null;
        if (contentEl) {
          highlightEl = document.createElement('div');
          highlightEl.style.cssText =
            'position:absolute;top:0;bottom:0;pointer-events:none;background:color-mix(in srgb, var(--primary) 6%, transparent);transition:left 50ms ease-out, width 50ms ease-out;';
          highlightEl.style.left = `${origLeftRef.current}px`;
          highlightEl.style.width = `${origWidthRef.current}px`;
          contentEl.insertBefore(highlightEl, contentEl.firstChild);
        }
      }

      const ppd = pixelsPerDayRef.current;
      const period = timePeriodRef.current;
      const snapPx = (px: number) => {
        if (period === 'quarter' || period === 'year') {
          // Snap to nearest week-start (Sunday)
          const timelineStart = timelineStartRef.current;
          const date = pixelToDate(px, timelineStart, ppd);
          const weekStart = startOfWeek(date, { weekStartsOn: 0 });
          return dateToPixel(weekStart, timelineStart, ppd);
        }
        return Math.round(px / ppd) * ppd;
      };

      let newLeft = origLeftRef.current;
      let newWidth = origWidthRef.current;

      switch (dragTypeRef.current) {
        case 'move':
          newLeft = snapPx(origLeftRef.current + dx);
          break;
        case 'resize-start': {
          const rawLeft = origLeftRef.current + dx;
          newLeft = snapPx(rawLeft);
          newWidth = origWidthRef.current + (origLeftRef.current - newLeft);
          if (newWidth < ppd) {
            newWidth = ppd;
            newLeft = origLeftRef.current + origWidthRef.current - ppd;
          }
          break;
        }
        case 'resize-end': {
          newWidth = snapPx(origWidthRef.current + dx);
          if (newWidth < ppd) newWidth = ppd;
          break;
        }
      }

      barEl.style.left = `${newLeft}px`;
      barEl.style.width = `${newWidth}px`;

      // Update highlight column
      if (highlightEl) {
        highlightEl.style.left = `${newLeft}px`;
        highlightEl.style.width = `${newWidth}px`;
      }

      // Live cascade preview for non-team-track tasks
      const taskId = dragTaskIdRef.current;
      const teamTrack = parseTeamTrackId(taskId);
      if (!teamTrack) {
        runCascadePreview(taskId, newLeft, newWidth);
      }

      // Update dependency lines to follow bar positions
      updateLinksPreview();
    }

    function runCascadePreview(taskId: string, newLeft: number, newWidth: number) {
      const ppd = pixelsPerDayRef.current;
      const timelineStart = timelineStartRef.current;
      const original = featureMapRef.current.get(taskId);
      if (!original) return;

      const newStartDate = pixelToDate(newLeft, timelineStart, ppd);
      const newDuration = Math.max(1, Math.round(newWidth / ppd));

      const override: Partial<ReflowMilestone> = {};
      if (dragTypeRef.current === 'move') {
        override.startDate = newStartDate;
      } else if (dragTypeRef.current === 'resize-start') {
        override.startDate = newStartDate;
        override.duration = newDuration;
      } else if (dragTypeRef.current === 'resize-end') {
        override.duration = newDuration;
      }

      const cascade = reflowProject(
        reflowMilestonesRef.current,
        reflowDepsRef.current,
        new Map([[taskId, override]])
      );

      const cascadeKey = cascade.map((u) => `${u.id}:${u.startDate.getTime()}:${u.endDate.getTime()}`).join(',');
      if (cascadeKey === lastCascadeKeyRef.current) return;
      lastCascadeKeyRef.current = cascadeKey;

      const newCascadedIds = new Set(cascade.map((u) => u.id));

      // Revert bars that no longer need cascading
      for (const [prevId, orig] of cascadeOriginalsRef.current) {
        if (!newCascadedIds.has(prevId)) {
          const el = container!.querySelector(`[data-task-id="${prevId}"]`) as HTMLElement;
          if (el) {
            el.style.left = `${orig.left}px`;
            el.style.width = `${orig.width}px`;
          }
          cascadeOriginalsRef.current.delete(prevId);
        }
      }

      for (const update of cascade) {
        if (update.id === taskId) continue;

        const el = container!.querySelector(`[data-task-id="${update.id}"]`) as HTMLElement;
        if (!el) continue;

        // Save originals
        if (!cascadeOriginalsRef.current.has(update.id)) {
          cascadeOriginalsRef.current.set(update.id, {
            left: parseFloat(el.style.left) || 0,
            width: parseFloat(el.style.width) || 0,
          });
        }

        const cascadeLeft = dateToPixel(update.startDate, timelineStart, ppd);
        const cascadeWidth = durationToPixels(
          Math.max(1, Math.round((update.endDate.getTime() - update.startDate.getTime()) / 86400000) + 1),
          ppd
        );
        el.style.left = `${cascadeLeft}px`;
        el.style.width = `${cascadeWidth}px`;
      }
    }

    const LINK_DELTA = 20;
    const LINK_R = 6;

    function updateLinksPreview() {
      const svg = container!.querySelector('.timeline-links-overlay') as SVGElement | null;
      if (!svg) return;
      const linkGroups = svg.querySelectorAll('g[data-link-id]');
      if (linkGroups.length === 0) return;

      // Build row index map from current tasks
      const tasks = tasksRef.current;
      const rowMap = new Map<string, number>();
      for (let i = 0; i < tasks.length; i++) {
        rowMap.set(tasks[i].id, i);
      }

      // Build position map from DOM
      const posMap = new Map<string, { left: number; right: number; centerY: number; row: number }>();
      for (const [taskId, row] of rowMap) {
        const el = container!.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement | null;
        if (!el) continue;
        const left = parseFloat(el.style.left) || 0;
        const width = parseFloat(el.style.width) || 0;
        posMap.set(taskId, {
          left,
          right: left + width,
          centerY: row * ROW_HEIGHT + ROW_HEIGHT / 2,
          row,
        });
      }

      for (const g of linkGroups) {
        const sourceId = g.getAttribute('data-link-source');
        const targetId = g.getAttribute('data-link-target');
        if (!sourceId || !targetId) continue;

        const source = posMap.get(sourceId);
        const target = posMap.get(targetId);
        if (!source || !target) continue;

        const sx = source.right;
        const sy = source.centerY;
        const tx = target.left;
        const ty = target.centerY;

        const minRow = Math.min(source.row, target.row);
        const maxRow = Math.max(source.row, target.row);

        let intermediateRight = sx;
        for (const [, info] of posMap) {
          if (info.row > minRow && info.row < maxRow) {
            intermediateRight = Math.max(intermediateRight, info.right);
          }
        }

        const clearX = Math.max(sx + LINK_DELTA, intermediateRight + LINK_DELTA);
        const tx1 = tx - LINK_DELTA;

        let pts: [number, number][];
        if (tx1 > clearX) {
          pts = [[sx, sy], [clearX, sy], [clearX, ty], [tx, ty]];
        } else {
          const midY = maxRow * ROW_HEIGHT;
          pts = [[sx, sy], [clearX, sy], [clearX, midY], [tx1, midY], [tx1, ty], [tx, ty]];
        }

        const d = roundedPath(pts, LINK_R);
        const paths = g.querySelectorAll('path');
        for (const p of paths) {
          p.setAttribute('d', d);
        }
      }
    }

    function onPointerUp(e: PointerEvent) {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      const barEl = barElRef.current;
      const taskId = dragTaskIdRef.current;

      if (barEl) barEl.classList.remove('timeline-bar-dragging');

      // Remove drag link highlights
      const svg = container!.querySelector('.timeline-links-overlay');
      if (svg) {
        svg.querySelectorAll('.link-highlight-drag')
          .forEach((g) => g.classList.remove('link-highlight', 'link-highlight-drag'));
      }

      // Remove highlight column
      if (highlightEl) {
        highlightEl.remove();
        highlightEl = null;
      }

      // Revert cascaded bars
      for (const [id, orig] of cascadeOriginalsRef.current) {
        const el = container!.querySelector(`[data-task-id="${id}"]`) as HTMLElement;
        if (el) {
          el.style.left = `${orig.left}px`;
          el.style.width = `${orig.width}px`;
        }
      }
      cascadeOriginalsRef.current.clear();
      lastCascadeKeyRef.current = '';

      if (!hasMovedRef.current && taskId) {
        // Click — not a drag
        onTaskClick(taskId);
      } else if (hasMovedRef.current && taskId && barEl) {
        // Commit drag
        const ppd = pixelsPerDayRef.current;
        const timelineStart = timelineStartRef.current;
        const finalLeft = parseFloat(barEl.style.left) || 0;
        const finalWidth = parseFloat(barEl.style.width) || 0;

        const startDate = pixelToDate(finalLeft, timelineStart, ppd);
        const duration = Math.max(1, Math.round(finalWidth / ppd));
        const endDate = addDays(startDate, duration - 1);

        const teamTrack = parseTeamTrackId(taskId);
        onDragEnd(taskId, startDate, endDate, duration, !!teamTrack, teamTrack);
      }

      if (hasMovedRef.current) {
        // Suppress the click event that fires after pointerup from a drag
        justDraggedRef.current = true;
        requestAnimationFrame(() => { justDraggedRef.current = false; });
      }

      isDraggingRef.current = false;
      dragTypeRef.current = null;
      dragTaskIdRef.current = null;
      barElRef.current = null;
      hasMovedRef.current = false;
    }

    function onClickCapture(e: MouseEvent) {
      if (justDraggedRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('click', onClickCapture, true);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [containerRef, pixelsPerDayRef, timelineStartRef, timePeriodRef, featureMapRef, predecessorMapRef, reflowMilestonesRef, reflowDepsRef, tasksRef, onDragEnd, onTaskClick, sentinelId]);
}
