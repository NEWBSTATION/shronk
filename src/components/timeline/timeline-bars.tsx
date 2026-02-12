'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { dateToPixel, durationToPixels } from './date-math';
import { ROW_HEIGHT } from './scales-config';
import type { TimelineTask } from './types';

interface TimelineBarsProps {
  tasks: TimelineTask[];
  pixelsPerDay: number;
  timelineStart: Date;
  onTaskClick?: (taskId: string) => void;
}

const BAR_HEIGHT = 40;
const BAR_TOP_PAD = 6;
const TEAM_BAR_HEIGHT = 32;
const TEAM_BAR_TOP_PAD = 10;

function dateRangeTitle(task: TimelineTask): string {
  if (!task.startDate || !task.endDate) return task.text || '';
  try {
    return `${task.text}\n${format(task.startDate, 'MMM d, yyyy')} — ${format(task.endDate, 'MMM d, yyyy')}`;
  } catch {
    return task.text || '';
  }
}

export function TimelineBars({ tasks, pixelsPerDay, timelineStart, onTaskClick }: TimelineBarsProps) {
  const bars = useMemo(() => {
    // Flatten: parent tasks first, children after. Compute row indices.
    const result: Array<{
      task: TimelineTask;
      left: number;
      width: number;
      top: number;
      rowIndex: number;
    }> = [];

    let rowIndex = 0;
    for (const task of tasks) {
      const left = dateToPixel(task.startDate, timelineStart, pixelsPerDay);
      const width = durationToPixels(task.duration, pixelsPerDay);
      const top = rowIndex * ROW_HEIGHT;
      result.push({ task, left, width, top, rowIndex });
      rowIndex++;
    }

    return result;
  }, [tasks, pixelsPerDay, timelineStart]);

  return (
    <div className="timeline-bars-layer" style={{ position: 'absolute', inset: 0 }}>
      {bars.map(({ task, left, width, top }) => {
        if (width <= 0 || task.duration === 0) return null;

        const custom = task.$custom;
        const isTeamTrack = custom?.isTeamTrack;
        const teamColor = custom?.teamColor;
        const isSummary = task.type === 'summary';
        const barHeight = isTeamTrack ? TEAM_BAR_HEIGHT : BAR_HEIGHT;
        const barTop = top + (isTeamTrack ? TEAM_BAR_TOP_PAD : BAR_TOP_PAD);
        const title = dateRangeTitle(task);

        return (
          <div
            key={task.id}
            className={`timeline-bar${isTeamTrack ? ' timeline-bar-team-track' : ''}${isSummary ? ' timeline-bar-summary' : ''}`}
            data-task-id={task.id}
            title={title}
            style={{
              position: 'absolute',
              left,
              top: barTop,
              width,
              height: barHeight,
              ...(isTeamTrack && teamColor
                ? {
                    backgroundColor: `color-mix(in srgb, ${teamColor} 40%, var(--background))`,
                    backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${teamColor}18 3px, ${teamColor}18 6px)`,
                  }
                : {}),
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick?.(task.id);
            }}
          >
            {/* Left resize handle */}
            <div className="timeline-bar-handle timeline-bar-handle-left" />

            {/* Right resize handle */}
            <div className="timeline-bar-handle timeline-bar-handle-right" />

            {/* Connection handles — only on parent/milestone bars, not team tracks */}
            {!isTeamTrack && (
              <>
                <div className="timeline-connect-handle timeline-connect-handle-left" />
                <div className="timeline-connect-handle timeline-connect-handle-right" />
              </>
            )}

            {/* Label + duration badge — positioned past the right connect handle (hidden for team tracks) */}
            {task.text && !isTeamTrack && (
              <div className="timeline-bar-label">
                {task.text}
                {task.durationText && (
                  <span className="timeline-bar-duration">{task.durationText}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
