'use client';

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { dateToPixel, durationToPixels } from './date-math';
import { ROW_HEIGHT } from './scales-config';
import type { TimelineTask } from './types';

interface TimelineBarsProps {
  tasks: TimelineTask[];
  pixelsPerDay: number;
  timelineStart: Date;
  onTaskClick?: (taskId: string) => void;
  hideTeamTracks?: boolean;
}

const BAR_HEIGHT = 40;
const BAR_TOP_PAD = 6;
const TEAM_BAR_HEIGHT = 32;
const TEAM_BAR_TOP_PAD = 10;

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_DOTS: Record<string, string> = {
  not_started: '#a1a1aa',
  in_progress: '#3b82f6',
  on_hold: '#f59e0b',
  completed: '#10b981',
  cancelled: '#a1a1aa',
};

function buildTooltipHTML(task: TimelineTask): string {
  const lines: string[] = [];

  if (task.startDate && task.endDate) {
    try {
      const range = `${format(task.startDate, 'MMM d')} – ${format(task.endDate, 'MMM d')}`;
      const dur = task.durationText ? ` (${task.durationText})` : '';
      lines.push(`<span class="timeline-bar-tooltip-date">${range}${dur}</span>`);
    } catch { /* skip */ }
  }

  const teamName = task.$custom?.teamName;
  if (teamName) {
    const tc = task.$custom?.teamColor ?? '#a1a1aa';
    lines.push(`<span class="timeline-bar-tooltip-team"><span class="timeline-bar-tooltip-dot" style="background:${tc}"></span>${teamName}</span>`);
  }

  return lines.join('');
}

export function TimelineBars({ tasks, pixelsPerDay, timelineStart, onTaskClick, hideTeamTracks }: TimelineBarsProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const taskMapRef = useRef<Map<string, TimelineTask>>(new Map());

  const bars = useMemo(() => {
    const result: Array<{
      task: TimelineTask;
      left: number;
      width: number;
      top: number;
      adjustedTop: number;
      rowIndex: number;
      isTeamTrack: boolean;
    }> = [];

    const map = new Map<string, TimelineTask>();
    let rowIndex = 0;
    let adjustedRowIndex = 0;
    for (const task of tasks) {
      const left = dateToPixel(task.startDate, timelineStart, pixelsPerDay);
      const width = durationToPixels(Math.max(1, task.duration), pixelsPerDay);
      const top = rowIndex * ROW_HEIGHT;
      const isTeam = !!task.$custom?.isTeamTrack;
      const adjustedTop = adjustedRowIndex * ROW_HEIGHT;
      result.push({ task, left, width, top, adjustedTop, rowIndex, isTeamTrack: isTeam });
      map.set(task.id, task);
      rowIndex++;
      if (!isTeam) adjustedRowIndex++;
    }
    taskMapRef.current = map;

    return result;
  }, [tasks, pixelsPerDay, timelineStart]);

  // Shared tooltip element — lives in the gantt container (outside overflow:hidden)
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const ganttContainer = layer.closest('.svar-timeline-container') as HTMLElement | null;
    if (!ganttContainer) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'timeline-bar-tooltip';
    tooltip.style.display = 'none';
    ganttContainer.appendChild(tooltip);
    tooltipRef.current = tooltip;

    return () => {
      tooltip.remove();
      tooltipRef.current = null;
    };
  }, []);

  const showTooltip = useCallback((barEl: HTMLElement, taskId: string) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const task = taskMapRef.current.get(taskId);
    if (!task) return;

    tooltip.innerHTML = buildTooltipHTML(task);

    const ganttContainer = tooltip.parentElement;
    if (!ganttContainer) return;

    const containerRect = ganttContainer.getBoundingClientRect();
    const barRect = barEl.getBoundingClientRect();

    // Position below the bar, centered horizontally
    tooltip.style.display = '';
    tooltip.style.opacity = '0';

    // Measure tooltip
    const tipRect = tooltip.getBoundingClientRect();

    let tipLeft = barRect.left + barRect.width / 2 - tipRect.width / 2 - containerRect.left;
    const tipTop = barRect.bottom + 8 - containerRect.top;

    // Clamp horizontal so it doesn't overflow the container
    tipLeft = Math.max(4, Math.min(tipLeft, containerRect.width - tipRect.width - 4));

    tooltip.style.left = `${tipLeft}px`;
    tooltip.style.top = `${tipTop}px`;
    tooltip.style.opacity = '1';
  }, []);

  const hideTooltip = useCallback(() => {
    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltip.style.display = 'none';
      tooltip.style.opacity = '0';
    }
  }, []);

  // Delegated mouse events on the bars layer
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    let hoveredBar: HTMLElement | null = null;
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    function highlightLinks(taskId: string | null) {
      const svg = layer.parentElement?.querySelector('.timeline-links-overlay');
      if (!svg) return;
      svg.querySelectorAll('[data-link-id].link-highlight').forEach((g) => g.classList.remove('link-highlight'));
      if (!taskId) return;
      svg.querySelectorAll(`[data-link-source="${taskId}"], [data-link-target="${taskId}"]`).forEach((g) => g.classList.add('link-highlight'));
    }

    function clearTooltipTimer() {
      if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
      }
    }

    function handleMouseOver(e: MouseEvent) {
      const bar = (e.target as HTMLElement).closest('.timeline-bar') as HTMLElement | null;
      if (!bar || bar === hoveredBar) return;
      hoveredBar = bar;
      const taskId = bar.dataset.taskId;
      if (taskId) {
        clearTooltipTimer();
        tooltipTimer = setTimeout(() => showTooltip(bar, taskId), 1200);
        highlightLinks(taskId);
      }
    }

    function handleMouseOut(e: MouseEvent) {
      const bar = (e.target as HTMLElement).closest('.timeline-bar') as HTMLElement | null;
      const related = (e.relatedTarget as HTMLElement | null)?.closest?.('.timeline-bar') as HTMLElement | null;
      if (bar === hoveredBar && related !== hoveredBar) {
        hoveredBar = null;
        clearTooltipTimer();
        hideTooltip();
        highlightLinks(null);
      }
    }

    function handleMouseDown() {
      hoveredBar = null;
      clearTooltipTimer();
      hideTooltip();
    }

    layer.addEventListener('mouseover', handleMouseOver);
    layer.addEventListener('mouseout', handleMouseOut);
    layer.addEventListener('mousedown', handleMouseDown);

    return () => {
      clearTooltipTimer();
      layer.removeEventListener('mouseover', handleMouseOver);
      layer.removeEventListener('mouseout', handleMouseOut);
      layer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [showTooltip, hideTooltip]);

  return (
    <div ref={layerRef} className="timeline-bars-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {bars.map(({ task, left, width, top, adjustedTop, isTeamTrack: isTeam }) => {
        if (width <= 0 && task.duration !== 0) return null;

        const custom = task.$custom;
        const teamColor = custom?.teamColor;
        const isSummary = task.type === 'summary';
        const isChainEnd = !!custom?.isChainEnd;
        const barHeight = isTeam ? TEAM_BAR_HEIGHT : BAR_HEIGHT;
        const baseTop = hideTeamTracks ? adjustedTop : top;
        const barTop = baseTop + (isTeam ? TEAM_BAR_TOP_PAD : BAR_TOP_PAD);
        const barOpacity = hideTeamTracks && isTeam ? 0 : 1;

        return (
          <div
            key={task.id}
            className={`timeline-bar${isTeam ? ' timeline-bar-team-track' : ''}${isSummary ? ' timeline-bar-summary' : ''}${isChainEnd ? ' timeline-bar-chain-end' : ''}${custom?.status === 'completed' ? ' timeline-bar-completed' : ''}`}
            data-task-id={task.id}
            style={{
              position: 'absolute',
              pointerEvents: hideTeamTracks && isTeam ? 'none' : 'auto',
              left,
              top: barTop,
              width,
              height: barHeight,
              opacity: barOpacity,
              transition: 'top 200ms ease, opacity 150ms ease',
              ...(isTeam && teamColor
                ? {
                    '--team-color': teamColor,
                    backgroundColor: `color-mix(in srgb, ${teamColor} 40%, var(--background))`,
                    backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${teamColor}18 3px, ${teamColor}18 6px)`,
                    backgroundSize: '8.49px 8.49px',
                    border: `1.5px solid color-mix(in srgb, ${teamColor} 35%, transparent)`,
                  } as React.CSSProperties
                : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick?.(task.id);
            }}
          >
            {/* Inner fill for chain-end fade mask */}
            {isChainEnd && !isTeam && <div className="timeline-bar-fill" />}

            {/* Left resize handle */}
            <div className="timeline-bar-handle timeline-bar-handle-left" />

            {/* Right resize handle */}
            <div className="timeline-bar-handle timeline-bar-handle-right" />

            {/* Connection handles — only on parent/milestone bars, not team tracks */}
            {!isTeam && (
              <>
                <div className="timeline-connect-handle timeline-connect-handle-left" />
                <div className="timeline-connect-handle timeline-connect-handle-right" />
              </>
            )}

            {/* Label + duration/done badge — positioned past the right connect handle (hidden for team tracks) */}
            {task.text && !isTeam && (
              <div className="timeline-bar-label">
                <span className="timeline-bar-label-text">{task.text}</span>
                {custom?.status === 'completed' ? (
                  <span className="timeline-bar-done-badge">Done</span>
                ) : (
                  task.durationText && (
                    <span className="timeline-bar-duration">{task.durationText}</span>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
