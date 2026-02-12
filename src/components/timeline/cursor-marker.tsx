'use client';

import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { format } from 'date-fns';
import { pixelToDate as pixelToDateFn } from './date-math';

interface CursorMarkerProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  pixelsPerDay: number;
  timelineStart: Date;
  scaleHeight: number;
  onCursorMove?: (info: { absoluteX: number; viewportX: number } | null) => void;
}

export function CursorMarker({ scrollRef, pixelsPerDay, timelineStart, scaleHeight, onCursorMove }: CursorMarkerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);

  const pixelToDate = useCallback(
    (absoluteX: number): Date | null => {
      if (pixelsPerDay <= 0) return null;
      return pixelToDateFn(absoluteX, timelineStart, pixelsPerDay);
    },
    [pixelsPerDay, timelineStart]
  );

  useEffect(() => {
    let mounted = true;
    let cleanupFn: (() => void) | null = null;

    function trySetup() {
      if (!mounted) return;

      const ganttContainer = containerRef.current?.closest('.svar-timeline-container') as HTMLElement | null;
      const scrollEl = scrollRef.current;
      if (!ganttContainer || !scrollEl) {
        requestAnimationFrame(trySetup);
        return;
      }

      const line = document.createElement('div');
      line.className = 'cursor-marker-line';
      line.style.cssText = `
        position: absolute;
        top: 0;
        width: 1px;
        pointer-events: none;
        z-index: 90;
        transform: translateX(-0.5px);
        display: none;
        background: color-mix(in srgb, var(--muted-foreground) 30%, transparent);
      `;
      ganttContainer.appendChild(line);
      lineRef.current = line;

      const label = document.createElement('div');
      label.className = 'cursor-marker-label';
      label.style.cssText = `
        position: absolute;
        pointer-events: none;
        z-index: 110;
        display: none;
        font-size: 10px;
        font-weight: 500;
        font-family: var(--font-sans);
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        background: var(--muted);
        color: var(--muted-foreground);
        border: 1px solid var(--border);
      `;
      ganttContainer.appendChild(label);
      labelRef.current = label;

      function handleMouseMove(e: MouseEvent) {
        if (!scrollEl || !line || !label) return;

        const scrollRect = scrollEl.getBoundingClientRect();
        const viewportX = e.clientX - scrollRect.left;

        if (viewportX < 0 || viewportX > scrollRect.width) {
          hide();
          return;
        }

        const absoluteX = viewportX + scrollEl.scrollLeft;

        // Position line in ganttContainer using viewport-relative coords (like today marker)
        const containerRect = ganttContainer.getBoundingClientRect();
        const chartLeft = scrollRect.left - containerRect.left;
        const visibleX = chartLeft + viewportX;
        const chartTop = scrollRect.top - containerRect.top;

        const scrollbarHeight = scrollEl.offsetHeight - scrollEl.clientHeight;
        const lineHeight = scrollRect.height - scrollbarHeight;

        line.style.left = `${visibleX}px`;
        line.style.top = `${chartTop}px`;
        line.style.height = `${lineHeight}px`;
        line.style.display = '';

        const date = pixelToDate(absoluteX);
        if (date) {
          label.textContent = format(date, 'MMM d, yyyy');
        }

        const chartBottom = scrollRect.bottom - containerRect.top - scrollbarHeight;

        label.style.left = `${e.clientX - containerRect.left}px`;
        label.style.top = `${chartBottom - 4}px`;
        label.style.transform = 'translate(-50%, -100%)';
        label.style.display = '';
        onCursorMove?.({ absoluteX, viewportX });
      }

      function handleMouseLeave() {
        hide();
        onCursorMove?.(null);
      }

      function handleScroll() {
        hide();
      }

      function hide() {
        if (line) line.style.display = 'none';
        if (label) label.style.display = 'none';
      }

      scrollEl.addEventListener('mousemove', handleMouseMove);
      scrollEl.addEventListener('mouseleave', handleMouseLeave);
      scrollEl.addEventListener('scroll', handleScroll);

      cleanupFn = () => {
        scrollEl.removeEventListener('mousemove', handleMouseMove);
        scrollEl.removeEventListener('mouseleave', handleMouseLeave);
        scrollEl.removeEventListener('scroll', handleScroll);
        line?.remove();
        label?.remove();
        lineRef.current = null;
        labelRef.current = null;
      };
    }

    requestAnimationFrame(trySetup);

    return () => {
      mounted = false;
      cleanupFn?.();
    };
  }, [pixelToDate, scaleHeight, onCursorMove, scrollRef]);

  return (
    <div
      ref={containerRef}
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
}
