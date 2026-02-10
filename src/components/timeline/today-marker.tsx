'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { startOfDay } from 'date-fns';

interface TodayMarkerProps {
  ganttApiRef: RefObject<any>;
  scaleHeight: number;
}

export function TodayMarker({ ganttApiRef, scaleHeight }: TodayMarkerProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
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
      const label = labelRef.current;
      if (!line || !label) {
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
        label.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      const today = startOfDay(new Date());
      const todayX = Math.round(scales.diff(today, scales.start, scales.lengthUnit) * state.cellWidth);

      if (todayX < 0) {
        line.style.display = 'none';
        label.style.display = 'none';
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
        label.style.display = 'none';
      } else {
        line.style.display = 'block';
        line.style.left = `${visibleX}px`;

        label.style.display = 'block';
        label.style.left = `${visibleX}px`;
        label.style.top = `${chartTop + 4}px`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      <div
        ref={lineRef}
        style={{
          position: 'absolute',
          top: 0,
          width: 2,
          height: 9999,
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--destructive, #ef4444)',
          boxShadow: '0 0 8px var(--destructive, #ef4444)',
          display: 'none',
        }}
      />
      <div
        ref={labelRef}
        className="today-marker-label"
        style={{
          position: 'absolute',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--destructive, #ef4444)',
          color: 'var(--destructive-foreground, #fff)',
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: 'var(--radius, 6px)',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          display: 'none',
          zIndex: 101,
        }}
      >
        Today
      </div>
    </div>
  );
}
