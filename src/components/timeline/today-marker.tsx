'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { startOfDay } from 'date-fns';

interface TodayMarkerProps {
  ganttApiRef: RefObject<any>;
  scaleHeight: number;
}

export function TodayMarker({ ganttApiRef, scaleHeight }: TodayMarkerProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    const ganttContainer = wrapper.closest('.svar-timeline-container');
    if (!ganttContainer) return;

    let mounted = true;
    let rafId: number;
    let scrollEl: HTMLElement | null = null;

    const tick = () => {
      if (!mounted) return;

      const line = lineRef.current;
      const dot = dotRef.current;
      if (!line || !dot) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Lazily find scroll container
      if (!scrollEl) {
        const wxArea = ganttContainer.querySelector('[class*="wx-area"]') as HTMLElement | null;
        if (wxArea) scrollEl = wxArea.parentElement as HTMLElement;
      }
      if (!scrollEl) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Use SVAR's internal scales for pixel-perfect position
      const api = ganttApiRef.current;
      const state = api?.getState?.() as any;
      const scales = state?._scales;
      if (!scales?.diff || !scales.start || !scales.lengthUnit || !state?.cellWidth) {
        line.style.display = 'none';
        dot.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      const today = startOfDay(new Date());
      const todayX = Math.round(scales.diff(today, scales.start, scales.lengthUnit) * state.cellWidth);

      if (todayX < 0) {
        line.style.display = 'none';
        dot.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Convert content position to screen position
      const ganttRect = ganttContainer.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const chartLeft = scrollRect.left - ganttRect.left;
      const chartTop = scrollRect.top - ganttRect.top;
      const chartWidth = scrollRect.width;
      const visibleX = chartLeft + todayX - scrollEl.scrollLeft;

      if (visibleX < chartLeft - 2 || visibleX > chartLeft + chartWidth + 2) {
        line.style.display = 'none';
        dot.style.display = 'none';
      } else {
        // Position dot centered on the bottom border of the timescale header
        const headerBottom = chartTop + scaleHeight * 2;

        dot.style.display = 'block';
        dot.style.left = `${visibleX}px`;
        dot.style.top = `${headerBottom}px`;

        // Line starts from the dot, extends down
        line.style.display = 'block';
        line.style.left = `${visibleX}px`;
        line.style.top = `${headerBottom}px`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const DOT_SIZE = 7;

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      <div
        ref={lineRef}
        style={{
          position: 'absolute',
          width: 1.5,
          height: 9999,
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--destructive)',
          boxShadow: '0 0 6px color-mix(in srgb, var(--destructive) 35%, transparent)',
          opacity: 1,
          display: 'none',
        }}
      />
      <div
        ref={dotRef}
        style={{
          position: 'absolute',
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: '50%',
          transform: `translate(-50%, -50%)`,
          backgroundColor: 'var(--destructive)',
          display: 'none',
          zIndex: 101,
        }}
      />
    </div>
  );
}
