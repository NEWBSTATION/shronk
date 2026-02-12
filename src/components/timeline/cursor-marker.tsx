'use client';

import { useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import type { IApi } from '@svar-ui/react-gantt';

interface CursorMarkerProps {
  ganttApiRef: React.RefObject<IApi | null>;
  scaleHeight: number;
  /** Called with the absolute pixel X in the content area and the viewport-relative X on each mousemove. Null on mouseleave. */
  onCursorMove?: (info: { absoluteX: number; viewportX: number } | null) => void;
}

/**
 * Cursor Marker component for SVAR Gantt chart.
 *
 * Renders a subtle vertical line that follows the mouse across the chart area,
 * with a date label at the top showing the hovered date.
 * Uses the same DOM-injection pattern as TodayMarker.
 */
export function CursorMarker({ ganttApiRef, scaleHeight, onCursorMove }: CursorMarkerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);

  const pixelToDate = useCallback(
    (absoluteX: number): Date | null => {
      const api = ganttApiRef.current;
      if (!api) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = api.getState() as any;
      const scales = state?._scales;
      if (!scales?.start || !scales.lengthUnit || !scales.add) return null;

      // absoluteX / cellWidth = fractional units from scales.start
      const fractionalUnits = absoluteX / state.cellWidth;
      // Use SVAR's add function to convert fractional units back to a date
      const date = scales.add(scales.start, fractionalUnits, scales.lengthUnit);
      return date instanceof Date ? date : null;
    },
    [ganttApiRef]
  );

  useEffect(() => {
    const ganttContainer = containerRef.current?.closest('.svar-timeline-container');
    if (!ganttContainer) return;

    let line: HTMLDivElement | null = null;
    let label: HTMLDivElement | null = null;
    let chartArea: HTMLElement | null = null;
    let scrollContainer: HTMLElement | null = null;

    const setup = () => {
      const wxArea = ganttContainer.querySelector('.wx-area') as HTMLElement;
      if (!wxArea) return false;

      scrollContainer = wxArea.parentElement;
      chartArea = wxArea;
      if (!scrollContainer) return false;

      // Create the line (lives inside .wx-area, scrolls with content)
      line = document.createElement('div');
      line.className = 'cursor-marker-line';
      line.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        width: 1px;
        pointer-events: none;
        z-index: 90;
        transform: translateX(-0.5px);
        display: none;
        background: var(--muted-foreground);
      `;
      wxArea.appendChild(line);
      lineRef.current = line;

      // Create the label (lives inside the scroll container, positioned sticky-like)
      label = document.createElement('div');
      label.className = 'cursor-marker-label';
      label.style.cssText = `
        position: fixed;
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
      document.body.appendChild(label);
      labelRef.current = label;

      return true;
    };

    // Try setup immediately, poll if SVAR hasn't rendered yet
    let ready = setup();
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (!ready) {
      pollInterval = setInterval(() => {
        ready = setup();
        if (ready && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
          attachListeners();
        }
      }, 100);
      const pollTimeout = setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
      }, 5000);

      return () => {
        clearTimeout(pollTimeout);
        if (pollInterval) clearInterval(pollInterval);
        cleanup();
      };
    }

    function handleMouseMove(e: MouseEvent) {
      if (!scrollContainer || !chartArea || !line || !label) return;

      const rect = scrollContainer.getBoundingClientRect();
      const viewportX = e.clientX - rect.left;

      // Skip if cursor is outside the chart viewport
      if (viewportX < 0 || viewportX > rect.width) {
        hide();
        return;
      }

      const absoluteX = viewportX + scrollContainer.scrollLeft;

      // Position the line at absoluteX within .wx-area
      line.style.left = `${absoluteX}px`;
      line.style.display = '';

      // Convert pixel to date for the label
      const date = pixelToDate(absoluteX);
      if (date) {
        label.textContent = format(date, 'MMM d, yyyy');
      }

      // Position label at top of chart area, following cursor horizontally (fixed positioning)
      label.style.left = `${e.clientX}px`;
      label.style.top = `${rect.top + 4}px`;
      label.style.transform = 'translateX(-50%)';
      label.style.display = '';

      onCursorMove?.({ absoluteX, viewportX });
    }

    function handleMouseLeave() {
      hide();
      onCursorMove?.(null);
    }

    function hide() {
      if (line) line.style.display = 'none';
      if (label) label.style.display = 'none';
    }

    function attachListeners() {
      if (!scrollContainer) return;
      scrollContainer.addEventListener('mousemove', handleMouseMove);
      scrollContainer.addEventListener('mouseleave', handleMouseLeave);
    }

    function detachListeners() {
      if (!scrollContainer) return;
      scrollContainer.removeEventListener('mousemove', handleMouseMove);
      scrollContainer.removeEventListener('mouseleave', handleMouseLeave);
    }

    function cleanup() {
      detachListeners();
      line?.remove();
      label?.remove();
      lineRef.current = null;
      labelRef.current = null;
    }

    if (ready) {
      attachListeners();
    }

    return cleanup;
  }, [pixelToDate, scaleHeight, onCursorMove]);

  return (
    <div
      ref={containerRef}
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
}
