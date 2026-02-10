"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  format,
  differenceInDays,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
  eachDayOfInterval,
  getWeek,
  getQuarter,
  isSameDay,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GripVertical,
  Circle,
  Clock,
  PauseCircle,
  CircleCheck,
  XCircle,
  Plus,
  ZoomIn,
  ZoomOut,
  CalendarDays,
} from "lucide-react";
import type { Milestone, MilestoneStatus, Team, Project } from "@/db/schema";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";

// Constants
const ROW_HEIGHT = 56;
const SIDEBAR_WIDTH = 280;
const MIN_BAR_WIDTH = 24;

// Time period types
type TimePeriod = "week" | "month" | "quarter" | "year";

// Time period configuration
// Sub-column widths at different zoom levels
// widthAtMinZoom = width at zoom level 1 (most zoomed out)
// widthAtMaxZoom = width at zoom level 9 (most zoomed in)
const TIME_PERIOD_CONFIG: Record<TimePeriod, {
  widthAtMinZoom: number;
  widthAtMaxZoom: number;
  headerHeight: number;
}> = {
  week: { widthAtMinZoom: 105, widthAtMaxZoom: 24, headerHeight: 72 },
  month: { widthAtMinZoom: 80, widthAtMaxZoom: 32, headerHeight: 72 },
  quarter: { widthAtMinZoom: 100, widthAtMaxZoom: 40, headerHeight: 72 },
  year: { widthAtMinZoom: 140, widthAtMaxZoom: 60, headerHeight: 72 },
};

// Status icons mapping
const STATUS_ICONS: Record<MilestoneStatus, typeof Circle> = {
  not_started: Circle,
  in_progress: Clock,
  on_hold: PauseCircle,
  completed: CircleCheck,
  cancelled: XCircle,
};

// Helper to get local midnight
function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Get today at local midnight
function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

type DragType = "move" | "resize-start" | "resize-end" | null;

interface DragState {
  type: DragType;
  featureId: string;
  initialMouseX: number;
  initialLeft: number;
  initialWidth: number;
  initialStartDate: Date;
  initialEndDate: Date;
  initialScrollLeft: number;
  hasMoved: boolean;
}

interface PreviewDates {
  startDate: Date;
  endDate: Date;
}

interface FeatureTimelineProps {
  milestone: Project;
  features: Milestone[];
  teams: Team[];
  onBack: () => void;
  onEdit: (feature: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (
    id: string,
    startDate: Date,
    endDate: Date,
    cascadeAfter?: boolean
  ) => void;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
  onReorder: (featureId: string, newIndex: number) => void;
  onAddFeature: () => void;
}

export function FeatureTimeline({
  milestone,
  features,
  teams,
  onBack,
  onEdit,
  onDelete,
  onUpdateDates,
  onStatusChange,
  onReorder,
  onAddFeature,
}: FeatureTimelineProps) {
  // State
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [zoomLevel, setZoomLevel] = useState(5);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<Record<string, PreviewDates>>({});

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const wheelDeltaRef = useRef(0);

  // Sort features by sortOrder
  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [features]);

  // Timeline bounds
  const timelineBounds = useMemo(() => ({
    start: TIMELINE_START_DATE,
    end: TIMELINE_END_DATE,
  }), []);

  // Calculate sub-column width based on time period and zoom
  // Higher zoom = more zoomed in = narrower columns (see more detail in time)
  const subColumnWidth = useMemo(() => {
    const config = TIME_PERIOD_CONFIG[timePeriod];
    const t = (zoomLevel - 1) / 8; // normalize 1-9 to 0-1
    // Interpolate from widthAtMinZoom (zoom 1) to widthAtMaxZoom (zoom 9)
    return config.widthAtMinZoom + (config.widthAtMaxZoom - config.widthAtMinZoom) * t;
  }, [timePeriod, zoomLevel]);

  // Calculate pixels per day based on time period and sub-column width
  const dayWidth = useMemo(() => {
    switch (timePeriod) {
      case "week":
        return subColumnWidth; // 1 sub-column = 1 day
      case "month":
        return subColumnWidth / 7; // 1 sub-column = 1 week (7 days)
      case "quarter":
        return subColumnWidth / 30.44; // 1 sub-column = ~1 month
      case "year":
        return subColumnWidth / 91.31; // 1 sub-column = ~1 quarter
      default:
        return subColumnWidth / 7;
    }
  }, [timePeriod, subColumnWidth]);

  // Generate header structure (only depends on timePeriod, not zoom)
  // Positions are calculated at render time using index * subColumnWidth
  const headerStructure = useMemo(() => {
    const today = getToday();
    const groups: Array<{
      key: string;
      labelLeft: string;
      labelRight: string;
      startIndex: number;
      subColumns: Array<{
        key: string;
        labelLeft: string;
        labelRight: string;
        index: number;
        isToday: boolean;
        date: Date;
      }>;
    }> = [];

    let currentIndex = 0;

    switch (timePeriod) {
      case "week": {
        const weeks = eachWeekOfInterval(
          { start: timelineBounds.start, end: timelineBounds.end },
          { weekStartsOn: 0 }
        );

        weeks.forEach((weekStart) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
          const clampedStart = weekStart < timelineBounds.start ? timelineBounds.start : weekStart;
          const clampedEnd = weekEnd > timelineBounds.end ? timelineBounds.end : weekEnd;

          const days = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
          const subColumns: typeof groups[0]["subColumns"] = [];

          days.forEach((day) => {
            subColumns.push({
              key: day.toISOString(),
              labelLeft: format(day, "d"),
              labelRight: format(day, "EEE").charAt(0),
              index: currentIndex,
              isToday: isSameDay(day, today),
              date: day,
            });
            currentIndex++;
          });

          if (subColumns.length > 0) {
            groups.push({
              key: weekStart.toISOString(),
              labelLeft: `${format(clampedStart, "MMM d")} - ${format(clampedEnd, "d")}`,
              labelRight: `W${getWeek(weekStart)}`,
              startIndex: subColumns[0].index,
              subColumns,
            });
          }
        });
        break;
      }

      case "month": {
        const months = eachMonthOfInterval({ start: timelineBounds.start, end: timelineBounds.end });

        months.forEach((monthStart) => {
          const monthEnd = endOfMonth(monthStart);
          const clampedStart = monthStart < timelineBounds.start ? timelineBounds.start : monthStart;
          const clampedEnd = monthEnd > timelineBounds.end ? timelineBounds.end : monthEnd;

          const weeks = eachWeekOfInterval(
            { start: clampedStart, end: clampedEnd },
            { weekStartsOn: 0 }
          );

          const subColumns: typeof groups[0]["subColumns"] = [];

          weeks.forEach((weekStart) => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
            const displayStart = weekStart < clampedStart ? clampedStart : weekStart;
            const displayEnd = weekEnd > clampedEnd ? clampedEnd : weekEnd;

            subColumns.push({
              key: weekStart.toISOString(),
              labelLeft: `${format(displayStart, "d")}-${format(displayEnd, "d")}`,
              labelRight: `W${getWeek(weekStart)}`,
              index: currentIndex,
              isToday: today >= displayStart && today <= displayEnd,
              date: displayStart,
            });
            currentIndex++;
          });

          if (subColumns.length > 0) {
            groups.push({
              key: monthStart.toISOString(),
              labelLeft: format(monthStart, "MMM"),
              labelRight: format(monthStart, "yyyy"),
              startIndex: subColumns[0].index,
              subColumns,
            });
          }
        });
        break;
      }

      case "quarter": {
        const quarters = eachQuarterOfInterval({ start: timelineBounds.start, end: timelineBounds.end });

        quarters.forEach((quarterStart) => {
          const quarterEnd = endOfQuarter(quarterStart);
          const clampedStart = quarterStart < timelineBounds.start ? timelineBounds.start : quarterStart;
          const clampedEnd = quarterEnd > timelineBounds.end ? timelineBounds.end : quarterEnd;

          const months = eachMonthOfInterval({ start: clampedStart, end: clampedEnd });
          const subColumns: typeof groups[0]["subColumns"] = [];

          months.forEach((monthStart) => {
            const monthEnd = endOfMonth(monthStart);
            const hasToday = today >= monthStart && today <= monthEnd;

            subColumns.push({
              key: monthStart.toISOString(),
              labelLeft: format(monthStart, "MMM"),
              labelRight: "",
              index: currentIndex,
              isToday: hasToday,
              date: monthStart,
            });
            currentIndex++;
          });

          if (subColumns.length > 0) {
            groups.push({
              key: quarterStart.toISOString(),
              labelLeft: `Q${getQuarter(quarterStart)}`,
              labelRight: format(quarterStart, "yyyy"),
              startIndex: subColumns[0].index,
              subColumns,
            });
          }
        });
        break;
      }

      case "year": {
        const years = eachYearOfInterval({ start: timelineBounds.start, end: timelineBounds.end });

        years.forEach((yearStart) => {
          const yearEnd = endOfYear(yearStart);
          const clampedStart = yearStart < timelineBounds.start ? timelineBounds.start : yearStart;
          const clampedEnd = yearEnd > timelineBounds.end ? timelineBounds.end : yearEnd;

          const quarters = eachQuarterOfInterval({ start: clampedStart, end: clampedEnd });
          const subColumns: typeof groups[0]["subColumns"] = [];

          quarters.forEach((quarterStart) => {
            const quarterEnd = endOfQuarter(quarterStart);
            const hasToday = today >= quarterStart && today <= quarterEnd;

            subColumns.push({
              key: quarterStart.toISOString(),
              labelLeft: `Q${getQuarter(quarterStart)}`,
              labelRight: "",
              index: currentIndex,
              isToday: hasToday,
              date: quarterStart,
            });
            currentIndex++;
          });

          if (subColumns.length > 0) {
            groups.push({
              key: yearStart.toISOString(),
              labelLeft: format(yearStart, "yyyy"),
              labelRight: "",
              startIndex: subColumns[0].index,
              subColumns,
            });
          }
        });
        break;
      }
    }

    return { groups, totalColumns: currentIndex };
  }, [timePeriod, timelineBounds]);

  // Calculate total timeline width
  const timelineWidth = headerStructure.totalColumns * subColumnWidth;

  // Get snap unit in days based on time period
  const getSnapDays = useCallback(() => {
    switch (timePeriod) {
      case "week": return 1; // snap to days
      case "month": return 7; // snap to weeks
      case "quarter": return 30; // snap to ~months
      case "year": return 91; // snap to ~quarters
      default: return 1;
    }
  }, [timePeriod]);

  // Snap date to nearest unit
  const snapDate = useCallback((date: Date, direction: "start" | "end"): Date => {
    switch (timePeriod) {
      case "week":
        return date; // snap to day (already at day granularity)
      case "month":
        // snap to week
        if (direction === "start") {
          return startOfWeek(date, { weekStartsOn: 0 });
        }
        return endOfWeek(date, { weekStartsOn: 0 });
      case "quarter":
        // snap to month
        if (direction === "start") {
          return startOfMonth(date);
        }
        return endOfMonth(date);
      case "year":
        // snap to quarter
        if (direction === "start") {
          return startOfQuarter(date);
        }
        return endOfQuarter(date);
      default:
        return date;
    }
  }, [timePeriod]);

  // Get bar position for a feature
  const getBarPosition = useCallback(
    (feature: Milestone) => {
      const preview = previewDates[feature.id];
      const startDate = preview
        ? preview.startDate
        : toLocalMidnight(feature.startDate);
      const endDate = preview
        ? preview.endDate
        : toLocalMidnight(feature.endDate);

      const left = differenceInDays(startDate, timelineBounds.start) * dayWidth;
      const width = Math.max(
        MIN_BAR_WIDTH,
        (differenceInDays(endDate, startDate) + 1) * dayWidth
      );

      return { left, width };
    },
    [dayWidth, previewDates, timelineBounds.start]
  );

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (!timelineRef.current) return;
    const today = getToday();
    const daysFromStart = differenceInDays(today, timelineBounds.start);
    const scrollPosition = daysFromStart * dayWidth - timelineRef.current.clientWidth / 3;
    timelineRef.current.scrollLeft = Math.max(0, scrollPosition);
  }, [dayWidth, timelineBounds.start]);

  // Scroll to today on mount and when time period changes
  useEffect(() => {
    scrollToToday();
  }, [scrollToToday]);

  // Sync header scroll with timeline scroll
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarRef.current && headerRef.current) {
      sidebarRef.current.scrollTop = timelineRef.current.scrollTop;
      headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
    }
  }, []);

  const handleSidebarScroll = useCallback(() => {
    if (timelineRef.current && sidebarRef.current) {
      timelineRef.current.scrollTop = sidebarRef.current.scrollTop;
    }
  }, []);

  // Handle wheel events for zoom (Ctrl+wheel) and horizontal scroll (Shift+wheel)
  // Accumulate wheel delta to match ClickUp behavior (8 wheel notches = full zoom range)
  const WHEEL_THRESHOLD = 100; // ~1 mouse wheel notch
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();

        // Accumulate wheel delta
        wheelDeltaRef.current += e.deltaY;

        // Check if we've crossed the threshold for a zoom step
        if (Math.abs(wheelDeltaRef.current) >= WHEEL_THRESHOLD) {
          const steps = Math.trunc(wheelDeltaRef.current / WHEEL_THRESHOLD);
          wheelDeltaRef.current -= steps * WHEEL_THRESHOLD;

          setZoomLevel((z) => {
            // Negative steps = zoom in, positive = zoom out
            const newZoom = Math.max(1, Math.min(9, z - steps));
            return newZoom;
          });
        }
      } else if (e.shiftKey) {
        // Shift + wheel = horizontal scroll
        e.preventDefault();
        if (timelineRef.current) {
          timelineRef.current.scrollLeft += e.deltaY;
        }
      }
    },
    []
  );

  // Attach wheel listener to timeline container
  useEffect(() => {
    const timeline = timelineRef.current;
    const header = headerRef.current;

    if (timeline) {
      timeline.addEventListener("wheel", handleWheel, { passive: false });
    }
    if (header) {
      header.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      if (timeline) {
        timeline.removeEventListener("wheel", handleWheel);
      }
      if (header) {
        header.removeEventListener("wheel", handleWheel);
      }
    };
  }, [handleWheel]);

  // Drag handlers
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, feature: Milestone, type: DragType) => {
      if (!type) return;

      const pos = getBarPosition(feature);
      const scrollLeft = timelineRef.current?.scrollLeft || 0;

      setDragState({
        type,
        featureId: feature.id,
        initialMouseX: e.clientX,
        initialLeft: pos.left,
        initialWidth: pos.width,
        initialStartDate: toLocalMidnight(feature.startDate),
        initialEndDate: toLocalMidnight(feature.endDate),
        initialScrollLeft: scrollLeft,
        hasMoved: false,
      });
    },
    [getBarPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;

      const scrollLeft = timelineRef.current?.scrollLeft || 0;
      const scrollDelta = scrollLeft - dragState.initialScrollLeft;
      const mouseDelta = e.clientX - dragState.initialMouseX + scrollDelta;

      if (!dragState.hasMoved && Math.abs(mouseDelta) < 5) return;

      if (!dragState.hasMoved) {
        setDragState({ ...dragState, hasMoved: true });
      }

      // Snap to units based on time period
      const snapDays = getSnapDays();
      const daysDelta = Math.round(mouseDelta / dayWidth / snapDays) * snapDays;

      let newStartDate: Date;
      let newEndDate: Date;

      if (dragState.type === "move") {
        newStartDate = addDays(dragState.initialStartDate, daysDelta);
        newEndDate = addDays(dragState.initialEndDate, daysDelta);

        // Clamp to timeline bounds
        if (newStartDate < TIMELINE_START_DATE) {
          const adjustment = differenceInDays(TIMELINE_START_DATE, newStartDate);
          newStartDate = TIMELINE_START_DATE;
          newEndDate = addDays(newEndDate, adjustment);
        }
        if (newEndDate > TIMELINE_END_DATE) {
          const adjustment = differenceInDays(newEndDate, TIMELINE_END_DATE);
          newEndDate = TIMELINE_END_DATE;
          newStartDate = addDays(newStartDate, -adjustment);
        }
      } else if (dragState.type === "resize-start") {
        newStartDate = addDays(dragState.initialStartDate, daysDelta);
        newEndDate = dragState.initialEndDate;

        // Snap start date
        newStartDate = snapDate(newStartDate, "start");

        if (newStartDate > newEndDate) {
          newStartDate = newEndDate;
        }
        if (newStartDate < TIMELINE_START_DATE) {
          newStartDate = TIMELINE_START_DATE;
        }
      } else {
        newStartDate = dragState.initialStartDate;
        newEndDate = addDays(dragState.initialEndDate, daysDelta);

        // Snap end date
        newEndDate = snapDate(newEndDate, "end");

        if (newEndDate < newStartDate) {
          newEndDate = newStartDate;
        }
        if (newEndDate > TIMELINE_END_DATE) {
          newEndDate = TIMELINE_END_DATE;
        }
      }

      setPreviewDates({
        ...previewDates,
        [dragState.featureId]: { startDate: newStartDate, endDate: newEndDate },
      });
    },
    [dragState, dayWidth, previewDates, getSnapDays, snapDate]
  );

  const handleMouseUp = useCallback(async () => {
    if (!dragState) return;

    const preview = previewDates[dragState.featureId];

    if (!dragState.hasMoved) {
      const feature = sortedFeatures.find((f) => f.id === dragState.featureId);
      if (feature) {
        onEdit(feature);
      }
      setDragState(null);
      return;
    }

    if (preview) {
      const shouldCascade = dragState.type !== "resize-start";
      await onUpdateDates(
        dragState.featureId,
        preview.startDate,
        preview.endDate,
        shouldCascade
      );
    }

    setDragState(null);
    setPreviewDates((prev) => {
      const next = { ...prev };
      delete next[dragState.featureId];
      return next;
    });
  }, [dragState, previewDates, sortedFeatures, onEdit, onUpdateDates]);

  // Set up global mouse listeners for drag
  useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Content height
  const contentHeight = Math.max(sortedFeatures.length * ROW_HEIGHT, 300);

  // Today position
  const today = getToday();
  const todayPosition =
    today >= timelineBounds.start && today <= timelineBounds.end
      ? differenceInDays(today, timelineBounds.start) * dayWidth
      : null;

  const headerHeight = TIME_PERIOD_CONFIG[timePeriod].headerHeight;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2 flex-shrink-0">
        {/* Time period selector */}
        <Select value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          {/* Today button */}
          <Button variant="outline" size="sm" onClick={scrollToToday}>
            <CalendarDays className="h-4 w-4 mr-2" />
            Today
          </Button>

          {/* Zoom controls */}
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel((z) => Math.max(1, z - 1))}
              disabled={zoomLevel <= 1}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel((z) => Math.min(9, z + 1))}
              disabled={zoomLevel >= 9}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="flex flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-background">
        {/* Sidebar */}
        <div
          className="flex flex-col border-r border-border bg-background flex-shrink-0"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center px-4 border-b border-border bg-muted/50"
            style={{ height: headerHeight }}
          >
            <span className="text-sm font-medium">Features</span>
          </div>

          {/* Sidebar content */}
          <div
            ref={sidebarRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
            onScroll={handleSidebarScroll}
          >
            {sortedFeatures.map((feature) => {
              const StatusIcon = STATUS_ICONS[feature.status];
              const team = teams.find((t) => t.id === feature.teamId);
              const preview = previewDates[feature.id];
              const startDate = preview
                ? preview.startDate
                : toLocalMidnight(feature.startDate);
              const endDate = preview
                ? preview.endDate
                : toLocalMidnight(feature.endDate);
              const duration = differenceInDays(endDate, startDate) + 1;

              return (
                <div
                  key={feature.id}
                  className="flex items-center px-4 border-b border-border/50 hover:bg-muted/50 cursor-pointer group"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onEdit(feature)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 mr-2 cursor-grab flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          feature.status === "completed" && "text-green-500",
                          feature.status === "in_progress" && "text-blue-500",
                          feature.status === "on_hold" && "text-amber-500",
                          feature.status === "cancelled" && "text-red-400",
                          feature.status === "not_started" && "text-slate-400"
                        )}
                      />
                      <span className="text-sm font-medium truncate">
                        {feature.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {duration}d
                      </Badge>
                      {team && (
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: team.color }}
                          title={team.name}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sortedFeatures.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <p className="text-sm text-muted-foreground">
                  No features yet. Add your first feature to get started.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline header */}
          <div
            ref={headerRef}
            className="flex-shrink-0 border-b border-border bg-muted/30 overflow-hidden"
            style={{ height: headerHeight }}
          >
            <div
              className="relative h-full"
              style={{ width: timelineWidth, minWidth: "100%" }}
            >
              {/* Group headers (top row) */}
              <div className="h-1/2 relative border-b border-border/50">
                {headerStructure.groups.map((group) => (
                  <div
                    key={group.key}
                    className="absolute flex items-center justify-between px-2 border-r border-border h-full overflow-hidden"
                    style={{ left: group.startIndex * subColumnWidth, width: group.subColumns.length * subColumnWidth }}
                  >
                    <span className="text-xs font-medium truncate">{group.labelLeft}</span>
                    {group.labelRight && (
                      <span className="text-xs text-muted-foreground">{group.labelRight}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Sub-column headers (bottom row) */}
              <div className="h-1/2 relative">
                {headerStructure.groups.flatMap((group) =>
                  group.subColumns.map((col) => (
                    <div
                      key={`col-${col.index}`}
                      className={cn(
                        "absolute flex items-center justify-between px-1 border-r border-border/50 h-full overflow-hidden",
                        col.isToday && "bg-primary/10"
                      )}
                      style={{ left: col.index * subColumnWidth, width: subColumnWidth }}
                    >
                      <span className={cn(
                        "text-[10px] truncate",
                        col.isToday && "font-semibold text-primary"
                      )}>
                        {col.labelLeft}
                      </span>
                      {col.labelRight && (
                        <span className={cn(
                          "text-[10px] text-muted-foreground",
                          col.isToday && "text-primary"
                        )}>
                          {col.labelRight}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Timeline body */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-auto"
            onScroll={handleTimelineScroll}
          >
            <div
              className="relative"
              style={{ width: timelineWidth, height: contentHeight, minWidth: "100%" }}
            >
              {/* Sub-column grid lines */}
              {headerStructure.groups.flatMap((group) =>
                group.subColumns.map((col) => (
                  <div
                    key={`grid-${col.index}`}
                    className={cn(
                      "absolute top-0 bottom-0 border-r border-border/20",
                      col.isToday && "bg-primary/5"
                    )}
                    style={{ left: col.index * subColumnWidth, width: subColumnWidth }}
                  />
                ))
              )}

              {/* Group boundary lines (darker) */}
              {headerStructure.groups.map((group) => (
                <div
                  key={`boundary-${group.key}`}
                  className="absolute top-0 bottom-0 border-r border-border/40"
                  style={{ left: (group.startIndex + group.subColumns.length) * subColumnWidth }}
                />
              ))}

              {/* Today line */}
              {todayPosition !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                  style={{ left: todayPosition }}
                />
              )}

              {/* Row backgrounds */}
              {sortedFeatures.map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-b border-border/20"
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              {/* Feature bars */}
              {sortedFeatures.map((feature, index) => {
                const pos = getBarPosition(feature);
                const isDragging =
                  dragState?.featureId === feature.id && dragState.hasMoved;

                return (
                  <div
                    key={feature.id}
                    className="absolute"
                    style={{
                      top: index * ROW_HEIGHT + 8,
                      left: pos.left,
                      width: pos.width,
                      height: ROW_HEIGHT - 16,
                    }}
                  >
                    <div
                      className={cn(
                        "h-full rounded-md border transition-shadow cursor-pointer group relative",
                        isDragging && "shadow-lg ring-2 ring-primary/50",
                        feature.status === "completed"
                          ? "bg-green-500/20 border-green-500/40"
                          : feature.status === "in_progress"
                          ? "bg-blue-500/20 border-blue-500/40"
                          : feature.status === "on_hold"
                          ? "bg-amber-500/20 border-amber-500/40"
                          : feature.status === "cancelled"
                          ? "bg-red-400/20 border-red-400/40"
                          : "bg-slate-400/20 border-slate-400/40"
                      )}
                      onMouseDown={(e) => handleBarMouseDown(e, feature, "move")}
                    >
                      {/* Left resize handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-l-md"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBarMouseDown(e, feature, "resize-start");
                        }}
                      />

                      {/* Right resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-r-md"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBarMouseDown(e, feature, "resize-end");
                        }}
                      />

                      {/* Label (if bar is wide enough) */}
                      {pos.width > 80 && (
                        <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                          <span className="text-xs font-medium truncate">
                            {feature.title}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
