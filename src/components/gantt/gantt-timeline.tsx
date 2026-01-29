"use client";

import { forwardRef, useMemo } from "react";
import { GanttHeader } from "./gantt-header";
import { GanttBar } from "./gantt-bar";
import { GanttTodayIndicator } from "./gantt-today-indicator";
import {
  calculateBarPosition,
  getTodayPosition,
  isWeekendDay,
  toLocalMidnight,
  type TimelineRange,
  type HeaderCell,
} from "./utils/date-calculations";
import { eachDayOfInterval } from "date-fns";
import type { Milestone, Team } from "@/db/schema";

interface GanttTimelineProps {
  milestones: Milestone[];
  teams: Team[];
  timelineRange: TimelineRange;
  headerCells: { primary: HeaderCell[]; secondary: HeaderCell[] };
  dayWidth: number;
  rowHeight: number;
  headerHeight: number;
  timelineWidth: number;
  contentHeight: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onEdit: (milestone: Milestone) => void;
  onUpdateDates: (id: string, startDate: Date, endDate: Date) => void;
  onStatusChange: (id: string, status: Milestone["status"]) => void;
  onPriorityChange: (id: string, priority: Milestone["priority"]) => void;
  onDelete: (id: string) => void;
}

export const GanttTimeline = forwardRef<HTMLDivElement, GanttTimelineProps>(
  function GanttTimeline(
    {
      milestones,
      teams,
      timelineRange,
      headerCells,
      dayWidth,
      rowHeight,
      headerHeight,
      timelineWidth,
      contentHeight,
      onScroll,
      onEdit,
      onUpdateDates,
      onStatusChange,
      onPriorityChange,
      onDelete,
    },
    ref
  ) {
    // Generate weekend columns
    const weekendColumns = useMemo(() => {
      const days = eachDayOfInterval({
        start: timelineRange.start,
        end: timelineRange.end,
      });

      return days
        .map((day, index) => ({
          day,
          index,
          isWeekend: isWeekendDay(day),
        }))
        .filter((d) => d.isWeekend);
    }, [timelineRange]);

    const todayPosition = useMemo(
      () => getTodayPosition(timelineRange.start, dayWidth),
      [timelineRange.start, dayWidth]
    );

    const isTodayVisible =
      todayPosition >= 0 && todayPosition <= timelineWidth;

    return (
      <div ref={ref} className="h-full overflow-auto" onScroll={onScroll}>
        <div style={{ width: timelineWidth, minHeight: "100%" }}>
          {/* Header */}
          <GanttHeader
            primaryCells={headerCells.primary}
            secondaryCells={headerCells.secondary}
            headerHeight={headerHeight}
          />

          {/* Content */}
          <div
            className="relative"
            style={{ height: contentHeight, minHeight: 400 }}
          >
            {/* Weekend columns */}
            {weekendColumns.map(({ index }) => (
              <div
                key={index}
                className="absolute top-0 bottom-0 bg-muted/30"
                style={{
                  left: index * dayWidth,
                  width: dayWidth,
                }}
              />
            ))}

            {/* Grid lines */}
            {headerCells.primary.map((cell, index) => (
              <div
                key={index}
                className="absolute top-0 bottom-0 border-r border-border/50"
                style={{ left: (index + 1) * cell.width }}
              />
            ))}

            {/* Row lines */}
            {milestones.map((_, index) => (
              <div
                key={index}
                className="absolute left-0 right-0 border-b border-border/50"
                style={{ top: (index + 1) * rowHeight }}
              />
            ))}

            {/* Today indicator */}
            {isTodayVisible && (
              <GanttTodayIndicator position={todayPosition} />
            )}

            {/* Bars */}
            {milestones.map((milestone, index) => {
              const barPosition = calculateBarPosition(
                milestone.startDate,
                milestone.endDate,
                timelineRange.start,
                dayWidth
              );
              const team = teams.find((t) => t.id === milestone.teamId);

              return (
                <GanttBar
                  key={milestone.id}
                  milestone={milestone}
                  team={team}
                  position={barPosition}
                  rowIndex={index}
                  rowHeight={rowHeight}
                  dayWidth={dayWidth}
                  timelineStart={timelineRange.start}
                  onEdit={() => onEdit(milestone)}
                  onUpdateDates={(startDate, endDate) =>
                    onUpdateDates(milestone.id, startDate, endDate)
                  }
                  onStatusChange={(status) =>
                    onStatusChange(milestone.id, status)
                  }
                  onPriorityChange={(priority) =>
                    onPriorityChange(milestone.id, priority)
                  }
                  onDelete={() => onDelete(milestone.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);
