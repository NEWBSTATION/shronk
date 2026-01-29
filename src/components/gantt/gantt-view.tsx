"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { useGanttStore } from "@/store/gantt-store";
import { GanttSidebar } from "./gantt-sidebar";
import { GanttTimeline } from "./gantt-timeline";
import { GanttToolbar } from "./gantt-toolbar";
import { GanttDependencies } from "./gantt-dependencies";
import {
  calculateTimelineRange,
  getDayWidth,
  generateHeaderCells,
} from "./utils/date-calculations";
import type { Milestone, Team, MilestoneDependency } from "@/db/schema";

interface GanttViewProps {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  projectId: string;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (
    id: string,
    startDate: Date,
    endDate: Date
  ) => void;
  onStatusChange: (id: string, status: Milestone["status"]) => void;
  onPriorityChange: (id: string, priority: Milestone["priority"]) => void;
  onCreateDependency: (predecessorId: string, successorId: string) => void;
  onDeleteDependency: (id: string) => void;
}

const ROW_HEIGHT = 52;
const SIDEBAR_WIDTH = 260;

export function GanttView({
  milestones,
  dependencies,
  teams,
  projectId,
  onEdit,
  onDelete,
  onUpdateDates,
  onStatusChange,
  onPriorityChange,
  onCreateDependency,
  onDeleteDependency,
}: GanttViewProps) {
  const {
    timePeriod,
    zoomLevel,
    showDependencies,
    sidebarCollapsed,
  } = useGanttStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate timeline dimensions
  const dayWidth = useMemo(
    () => getDayWidth(timePeriod, zoomLevel),
    [timePeriod, zoomLevel]
  );

  const timelineRange = useMemo(
    () => calculateTimelineRange(milestones, timePeriod),
    [milestones, timePeriod]
  );

  const headerCells = useMemo(
    () => generateHeaderCells(timelineRange, timePeriod, zoomLevel),
    [timelineRange, timePeriod, zoomLevel]
  );

  const timelineWidth = timelineRange.totalDays * dayWidth;
  const contentHeight = milestones.length * ROW_HEIGHT;

  // Sync scroll between sidebar and timeline
  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const handleSidebarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (timelineRef.current) {
      timelineRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    if (timelineRef.current && milestones.length > 0) {
      const today = new Date();
      const daysFromStart = Math.floor(
        (today.getTime() - timelineRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const scrollPosition = daysFromStart * dayWidth - timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollLeft = Math.max(0, scrollPosition);
    }
  }, [timelineRange.start, dayWidth, milestones.length]);

  return (
    <div className="flex flex-col h-full">
      <GanttToolbar teams={teams} />

      <div className="flex flex-1 overflow-hidden border rounded-lg">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <GanttSidebar
            ref={sidebarRef}
            milestones={milestones}
            rowHeight={ROW_HEIGHT}
            width={SIDEBAR_WIDTH}
            onScroll={handleSidebarScroll}
            onEdit={onEdit}
          />
        )}

        {/* Timeline */}
        <div className="flex-1 relative overflow-hidden">
          <GanttTimeline
            ref={timelineRef}
            milestones={milestones}
            teams={teams}
            timelineRange={timelineRange}
            headerCells={headerCells}
            dayWidth={dayWidth}
            rowHeight={ROW_HEIGHT}
            timelineWidth={timelineWidth}
            contentHeight={contentHeight}
            onScroll={handleTimelineScroll}
            onEdit={onEdit}
            onUpdateDates={onUpdateDates}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onDelete={onDelete}
          />

          {/* Dependencies Layer */}
          {showDependencies && (
            <GanttDependencies
              milestones={milestones}
              dependencies={dependencies}
              timelineRange={timelineRange}
              dayWidth={dayWidth}
              rowHeight={ROW_HEIGHT}
              scrollTop={scrollTop}
              scrollLeft={timelineRef.current?.scrollLeft || 0}
              onCreateDependency={onCreateDependency}
              onDeleteDependency={onDeleteDependency}
            />
          )}
        </div>
      </div>
    </div>
  );
}
