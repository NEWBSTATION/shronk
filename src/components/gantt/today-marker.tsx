'use client';

import { useEffect, useRef, useCallback } from 'react';
import { differenceInDays, differenceInWeeks, differenceInMonths, differenceInQuarters, startOfDay, startOfWeek, startOfMonth, startOfQuarter } from 'date-fns';
import type { TimePeriod } from './types';

interface TodayMarkerProps {
  /** Start date of the timeline */
  timelineStart: Date;
  /** End date of the timeline */
  timelineEnd: Date;
  /** Current time period (affects position calculation) */
  timePeriod: TimePeriod;
  /** Cell width in pixels */
  cellWidth: number;
  /** Height of the scale header (marker starts below this) */
  scaleHeight: number;
}

/**
 * Custom Today Marker component for SVAR Gantt chart
 *
 * Injects a vertical "Today" line directly into SVAR's chart area
 * so it scrolls naturally with the content.
 */
export function TodayMarker({
  timelineStart,
  timelineEnd,
  timePeriod,
  cellWidth,
  scaleHeight,
}: TodayMarkerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);

  // Calculate today's position in pixels from the timeline start
  const calculateTodayPosition = useCallback((): number => {
    const today = startOfDay(new Date());

    // Check if today is within the timeline range
    if (today < timelineStart || today > timelineEnd) {
      return -1;
    }

    switch (timePeriod) {
      case 'week': {
        const daysFromStart = differenceInDays(today, timelineStart);
        return daysFromStart * cellWidth;
      }
      case 'month': {
        const timelineStartWeek = startOfWeek(timelineStart, { weekStartsOn: 0 });
        const todayWeek = startOfWeek(today, { weekStartsOn: 0 });
        const weeksFromStart = differenceInWeeks(todayWeek, timelineStartWeek);
        const daysIntoWeek = differenceInDays(today, todayWeek);
        const fractionOfWeek = daysIntoWeek / 7;
        return (weeksFromStart + fractionOfWeek) * cellWidth;
      }
      case 'quarter': {
        const timelineStartMonth = startOfMonth(timelineStart);
        const todayMonth = startOfMonth(today);
        const monthsFromStart = differenceInMonths(todayMonth, timelineStartMonth);
        const daysIntoMonth = differenceInDays(today, todayMonth);
        const daysInMonth = differenceInDays(
          new Date(today.getFullYear(), today.getMonth() + 1, 0),
          todayMonth
        ) + 1;
        const fractionOfMonth = daysIntoMonth / daysInMonth;
        return (monthsFromStart + fractionOfMonth) * cellWidth;
      }
      case 'year': {
        const timelineStartQuarter = startOfQuarter(timelineStart);
        const todayQuarter = startOfQuarter(today);
        const quartersFromStart = differenceInQuarters(todayQuarter, timelineStartQuarter);
        const quarterStart = startOfQuarter(today);
        const nextQuarterStart = new Date(quarterStart);
        nextQuarterStart.setMonth(nextQuarterStart.getMonth() + 3);
        const daysIntoQuarter = differenceInDays(today, quarterStart);
        const daysInQuarter = differenceInDays(nextQuarterStart, quarterStart);
        const fractionOfQuarter = daysIntoQuarter / daysInQuarter;
        return (quartersFromStart + fractionOfQuarter) * cellWidth;
      }
      default:
        return -1;
    }
  }, [timelineStart, timelineEnd, timePeriod, cellWidth]);

  // Inject marker into SVAR's chart area
  useEffect(() => {
    const container = containerRef.current?.closest('.svar-gantt-container');
    if (!container) return;

    const todayPosition = calculateTodayPosition();
    if (todayPosition < 0) return;

    // Create or update the marker element
    const createMarker = () => {
      // Find SVAR's chart area (the scrollable content area)
      const chartArea = container.querySelector('.wx-area') as HTMLElement;
      if (!chartArea) return null;

      // Remove existing marker if any
      const existingMarker = chartArea.querySelector('.today-marker-injected');
      if (existingMarker) {
        existingMarker.remove();
      }

      // Create the marker element
      const marker = document.createElement('div');
      marker.className = 'today-marker-injected';
      marker.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        left: ${todayPosition}px;
        width: 2px;
        pointer-events: none;
        z-index: 100;
        transform: translateX(-50%);
      `;

      // Create the label
      const label = document.createElement('div');
      label.className = 'today-marker-label';
      label.textContent = 'Today';
      label.style.cssText = `
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--destructive, #ef4444);
        color: var(--destructive-foreground, #ffffff);
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: var(--radius, 6px);
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        z-index: 101;
      `;

      // Create the line
      const line = document.createElement('div');
      line.className = 'today-marker-line';
      line.style.cssText = `
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px;
        transform: translateX(-50%);
        background-color: var(--destructive, #ef4444);
        box-shadow: 0 0 8px var(--destructive, #ef4444);
      `;

      marker.appendChild(label);
      marker.appendChild(line);
      chartArea.appendChild(marker);

      return marker;
    };

    // Try to create marker immediately
    let marker = createMarker();

    // If SVAR hasn't rendered yet, poll for it
    if (!marker) {
      const interval = setInterval(() => {
        marker = createMarker();
        if (marker) {
          markerRef.current = marker;
          clearInterval(interval);
        }
      }, 100);

      const timeout = setTimeout(() => clearInterval(interval), 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        marker?.remove();
      };
    }

    markerRef.current = marker;

    return () => {
      marker?.remove();
    };
  }, [calculateTodayPosition]);

  // Update marker position when cellWidth or timePeriod changes
  useEffect(() => {
    if (!markerRef.current) return;

    const todayPosition = calculateTodayPosition();
    if (todayPosition >= 0) {
      markerRef.current.style.left = `${todayPosition}px`;
    }
  }, [cellWidth, timePeriod, calculateTodayPosition]);

  // Render a hidden container just to get a DOM reference
  return (
    <div
      ref={containerRef}
      style={{ display: 'none' }}
      aria-hidden="true"
    />
  );
}
