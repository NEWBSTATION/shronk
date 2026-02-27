import { useEffect, useRef, type RefObject, type MutableRefObject } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { dateToPixel, pixelToDate, durationToPixels } from './date-math';
import type { TimePeriod } from './types';
import { parseTeamTrackId } from './transformers';
import { roundedPath } from './timeline-links';
import { ROW_HEIGHT } from './scales-config';
import { getTransitiveSuccessors } from '@/lib/graph-utils';
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
  successorMapRef: MutableRefObject<Map<string, string[]>>;
  tasksRef: MutableRefObject<TimelineTask[]>;
  onDragEnd: (
    taskId: string,
    startDate: Date,
    endDate: Date,
    duration: number,
    isTeamTrack: boolean,
    teamTrack: { milestoneId: string; teamId: string } | null,
    dragType?: DragType
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
  successorMapRef,
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
  // Summary bar child tracking
  const summaryChildOriginalsRef = useRef<Map<string, { left: number; width: number }>>(new Map());
  // Parent bar tracking for team track drags (to detect growth → cascade)
  const parentOriginalRef = useRef<{ el: HTMLElement; left: number; width: number; milestoneId: string } | null>(null);

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
      const teamTrack = parseTeamTrackId(taskId);

      // Find if this task is a summary bar (parent with visible team tracks)
      const currentTasks = tasksRef.current;
      const taskData = currentTasks.find(t => t.id === taskId);
      const isSummary = taskData?.type === 'summary';

      // Summary bars can only move (no resize handles)
      if (isSummary && dragType !== 'move') return;

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
      summaryChildOriginalsRef.current.clear();

      // Capture child bar positions for summary drag
      if (isSummary) {
        const children = currentTasks.filter(t => t.parent === taskId);
        for (const child of children) {
          const childEl = container!.querySelector(`[data-task-id="${child.id}"]`) as HTMLElement | null;
          if (childEl) {
            summaryChildOriginalsRef.current.set(child.id, {
              left: parseFloat(childEl.style.left) || 0,
              width: parseFloat(childEl.style.width) || 0,
            });
          }
        }
      }

      // Capture parent bar original dimensions for team track drags
      if (teamTrack) {
        const parentEl = container!.querySelector(`[data-task-id="${teamTrack.milestoneId}"]`) as HTMLElement | null;
        if (parentEl) {
          parentOriginalRef.current = {
            el: parentEl,
            left: parseFloat(parentEl.style.left) || 0,
            width: parseFloat(parentEl.style.width) || 0,
            milestoneId: teamTrack.milestoneId,
          };
        }
      } else {
        parentOriginalRef.current = null;
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('keydown', onKeyDown);
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
            'position:absolute;top:0;bottom:0;pointer-events:none;background:color-mix(in srgb, var(--primary) 10%, transparent);';
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

      // No left-clamp for moves — allow free overlap with predecessors (ClickUp-style)
      const taskId = dragTaskIdRef.current;
      const teamTrack = parseTeamTrackId(taskId);

      // Team track: grow parent bidirectionally if child exceeds bounds → cascade chain
      if (teamTrack && parentOriginalRef.current) {
        const { el: parentEl, left: parentLeft, width: parentWidth, milestoneId: parentId } = parentOriginalRef.current;
        const origParentRight = parentLeft + parentWidth;
        const teamRight = newLeft + newWidth;

        let newParentLeft = parentLeft;
        let newParentRight = origParentRight;
        let needsGrowth = false;

        // Grow left if child starts before parent
        if (newLeft < parentLeft) {
          newParentLeft = newLeft;
          needsGrowth = true;
        }
        // Grow right if child ends past parent
        if (teamRight > origParentRight) {
          newParentRight = teamRight;
          needsGrowth = true;
        }

        if (needsGrowth) {
          parentEl.style.left = `${newParentLeft}px`;
          parentEl.style.width = `${newParentRight - newParentLeft}px`;

          // Delta-shift parent's transitive successors by right-edge growth
          const rightGrowthPx = newParentRight - origParentRight;
          if (rightGrowthPx > 0) {
            const successors = getTransitiveSuccessors(parentId, successorMapRef.current);
            for (const succId of successors) {
              const el = container!.querySelector(`[data-task-id="${succId}"]`) as HTMLElement;
              if (!el) continue;
              if (!cascadeOriginalsRef.current.has(succId)) {
                cascadeOriginalsRef.current.set(succId, {
                  left: parseFloat(el.style.left) || 0,
                  width: parseFloat(el.style.width) || 0,
                });
              }
              const orig = cascadeOriginalsRef.current.get(succId)!;
              el.style.left = `${orig.left + rightGrowthPx}px`;
            }
          }
        } else {
          // Parent back to original — revert growth + successor shifts
          parentEl.style.left = `${parentLeft}px`;
          parentEl.style.width = `${parentWidth}px`;
          for (const [succId, orig] of cascadeOriginalsRef.current) {
            const el = container!.querySelector(`[data-task-id="${succId}"]`) as HTMLElement;
            if (el) {
              el.style.left = `${orig.left}px`;
              el.style.width = `${orig.width}px`;
            }
          }
          cascadeOriginalsRef.current.clear();
        }
      }

      // Summary bar: shift all children rigidly
      if (summaryChildOriginalsRef.current.size > 0 && dragTypeRef.current === 'move') {
        const moveDelta = newLeft - origLeftRef.current;
        for (const [childId, orig] of summaryChildOriginalsRef.current) {
          const childEl = container!.querySelector(`[data-task-id="${childId}"]`) as HTMLElement | null;
          if (childEl) {
            childEl.style.left = `${orig.left + moveDelta}px`;
          }
        }
      }

      barEl.style.left = `${newLeft}px`;
      barEl.style.width = `${newWidth}px`;

      // Update highlight column
      if (highlightEl) {
        highlightEl.style.left = `${newLeft}px`;
        highlightEl.style.width = `${newWidth}px`;
      }

      // Live delta-shift cascade preview for non-team-track tasks
      if (!teamTrack) {
        runCascadePreview(taskId, newLeft, newWidth);
      }

      // Update dependency lines to follow bar positions
      updateLinksPreview();
    }

    /**
     * Delta-shift cascade preview (ClickUp-style):
     * - resize-start: no cascade (return early)
     * - move: shift all transitive successors by the same px delta
     * - resize-end: shift all transitive successors by end-date delta
     */
    function runCascadePreview(taskId: string, newLeft: number, newWidth: number) {
      const dragType = dragTypeRef.current;

      // resize-start: no cascade at all
      if (dragType === 'resize-start') {
        // Revert any previously cascaded bars
        for (const [id, orig] of cascadeOriginalsRef.current) {
          const el = container!.querySelector(`[data-task-id="${id}"]`) as HTMLElement;
          if (el) {
            el.style.left = `${orig.left}px`;
            el.style.width = `${orig.width}px`;
          }
        }
        cascadeOriginalsRef.current.clear();
        lastCascadeKeyRef.current = '';
        return;
      }

      // Compute delta in pixels
      let deltaPx: number;
      if (dragType === 'move') {
        deltaPx = newLeft - origLeftRef.current;
      } else {
        // resize-end: delta of end position
        deltaPx = (newLeft + newWidth) - (origLeftRef.current + origWidthRef.current);
      }

      // BFS all transitive successors
      const successors = getTransitiveSuccessors(taskId, successorMapRef.current);

      const cascadeKey = `${deltaPx}:${[...successors].join(',')}`;
      if (cascadeKey === lastCascadeKeyRef.current) return;
      lastCascadeKeyRef.current = cascadeKey;

      // Revert bars that are no longer successors
      for (const [prevId, orig] of cascadeOriginalsRef.current) {
        if (!successors.has(prevId)) {
          const el = container!.querySelector(`[data-task-id="${prevId}"]`) as HTMLElement;
          if (el) {
            el.style.left = `${orig.left}px`;
            el.style.width = `${orig.width}px`;
          }
          cascadeOriginalsRef.current.delete(prevId);
        }
      }

      for (const succId of successors) {
        const el = container!.querySelector(`[data-task-id="${succId}"]`) as HTMLElement;
        if (!el) continue;

        // Save originals on first touch
        if (!cascadeOriginalsRef.current.has(succId)) {
          cascadeOriginalsRef.current.set(succId, {
            left: parseFloat(el.style.left) || 0,
            width: parseFloat(el.style.width) || 0,
          });
        }

        const orig = cascadeOriginalsRef.current.get(succId)!;
        // Shift left by delta, keep width unchanged (gaps preserved)
        el.style.left = `${orig.left + deltaPx}px`;
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

    function cleanupDrag(preservePositions = false) {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('keydown', onKeyDown);

      const barEl = barElRef.current;
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

      // Revert parent expansion from team track drags
      if (parentOriginalRef.current) {
        if (!preservePositions) {
          parentOriginalRef.current.el.style.left = `${parentOriginalRef.current.left}px`;
          parentOriginalRef.current.el.style.width = `${parentOriginalRef.current.width}px`;
        }
        parentOriginalRef.current = null;
      }

      // Revert cascaded bars (skip on commit — React re-render handles it)
      if (!preservePositions) {
        for (const [id, orig] of cascadeOriginalsRef.current) {
          const el = container!.querySelector(`[data-task-id="${id}"]`) as HTMLElement;
          if (el) {
            el.style.left = `${orig.left}px`;
            el.style.width = `${orig.width}px`;
          }
        }
      }
      cascadeOriginalsRef.current.clear();
      lastCascadeKeyRef.current = '';

      // Revert summary children (skip on commit — React re-render handles it)
      if (!preservePositions) {
        for (const [childId, orig] of summaryChildOriginalsRef.current) {
          const childEl = container!.querySelector(`[data-task-id="${childId}"]`) as HTMLElement;
          if (childEl) {
            childEl.style.left = `${orig.left}px`;
            childEl.style.width = `${orig.width}px`;
          }
        }
      }
      summaryChildOriginalsRef.current.clear();

      // Revert dependency lines to original positions
      updateLinksPreview();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (!hasMovedRef.current) return;

      // Revert bar to original position
      const barEl = barElRef.current;
      if (barEl) {
        barEl.style.left = `${origLeftRef.current}px`;
        barEl.style.width = `${origWidthRef.current}px`;
      }

      cleanupDrag();

      isDraggingRef.current = false;
      dragTypeRef.current = null;
      dragTaskIdRef.current = null;
      barElRef.current = null;
      hasMovedRef.current = false;

      // Suppress click
      justDraggedRef.current = true;
      requestAnimationFrame(() => { justDraggedRef.current = false; });
    }

    function onPointerUp(e: PointerEvent) {
      const barEl = barElRef.current;
      const taskId = dragTaskIdRef.current;
      const dragType = dragTypeRef.current;

      if (!hasMovedRef.current && taskId) {
        // Click — not a drag
        cleanupDrag();
        onTaskClick(taskId);
      } else if (hasMovedRef.current && taskId && barEl) {
        // Commit drag — read final position before cleanup
        const ppd = pixelsPerDayRef.current;
        const timelineStart = timelineStartRef.current;
        const finalLeft = parseFloat(barEl.style.left) || 0;
        const finalWidth = parseFloat(barEl.style.width) || 0;

        const startDate = pixelToDate(finalLeft, timelineStart, ppd);
        const duration = Math.max(1, Math.round(finalWidth / ppd));
        const endDate = addDays(startDate, duration - 1);

        const teamTrack = parseTeamTrackId(taskId);

        // Preserve cascade/summary positions — React re-render from
        // the optimistic update will take over seamlessly (no flash)
        cleanupDrag(true);
        onDragEnd(taskId, startDate, endDate, duration, !!teamTrack, teamTrack, dragType ?? undefined);
      } else {
        cleanupDrag();
      }

      if (hasMovedRef.current) {
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
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, pixelsPerDayRef, timelineStartRef, timePeriodRef, featureMapRef, predecessorMapRef, successorMapRef, tasksRef, onDragEnd, onTaskClick, sentinelId]);
}
