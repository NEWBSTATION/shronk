'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { startOfDay } from 'date-fns';
import { dateToPixel } from './date-math';

interface TodayMarkerProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  pixelsPerDay: number;
  timelineStart: Date;
  scaleHeight: number;
}

export function TodayMarker({ scrollRef, pixelsPerDay, timelineStart, scaleHeight }: TodayMarkerProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    let mounted = true;
    let rafId: number;

    const tick = () => {
      if (!mounted) return;

      const line = lineRef.current;
      const dot = dotRef.current;
      const scrollEl = scrollRef.current;
      if (!line || !dot || !scrollEl) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const today = startOfDay(new Date());
      const todayX = dateToPixel(today, timelineStart, pixelsPerDay);

      if (todayX < 0) {
        line.style.display = 'none';
        dot.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      const ganttContainer = wrapper.parentElement;
      if (!ganttContainer) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const ganttRect = ganttContainer.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const chartLeft = scrollRect.left - ganttRect.left;
      const chartWidth = scrollRect.width;
      const chartTop = scrollRect.top - ganttRect.top;
      const visibleX = chartLeft + todayX - scrollEl.scrollLeft;

      if (visibleX < chartLeft - 2 || visibleX > chartLeft + chartWidth + 2) {
        line.style.display = 'none';
        dot.style.display = 'none';
      } else {
        dot.style.display = 'block';
        dot.style.left = `${visibleX}px`;
        dot.style.top = `${chartTop}px`;

        // Line starts where the dot is (scale/chart boundary)
        line.style.display = 'block';
        line.style.left = `${visibleX}px`;
        line.style.top = `${chartTop}px`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [scrollRef, pixelsPerDay, timelineStart, scaleHeight]);

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
