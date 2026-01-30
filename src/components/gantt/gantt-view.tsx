'use client';

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
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
  isWeekend,
  isSameDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
} from 'date-fns';
import { GripVertical, Circle, Clock, PauseCircle, CheckCircle2, XCircle, Flag, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GanttToolbar } from './gantt-toolbar';
import { GanttBar } from './gantt-bar';
import { DependencyLines } from './dependency-lines';
import { MilestoneContextMenu } from './milestone-context-menu';
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  SIDEBAR_WIDTH,
  TIME_PERIOD_CONFIG,
  STATUS_CONFIG,
  TIMELINE_START_DATE,
  TIMELINE_END_DATE,
  MIN_BAR_WIDTH,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
} from './constants';
import type {
  GanttViewProps,
  TimePeriod,
  DragState,
  DragType,
  PreviewDates,
  ConnectionSide,
  DependencyCreationState,
  GanttFilters,
  GanttSort,
  MilestoneWithDeps,
  BarPosition,
} from './types';
import type { Milestone, MilestoneStatus, MilestonePriority } from '@/db/schema';

// Virtualization buffer (render extra cells outside viewport)
const VIRTUALIZATION_BUFFER = 200; // pixels

// Helper to parse a date and get midnight in local time
function toLocalMidnight(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(year, month, day);
}

// Status icons mapping
const STATUS_ICONS: Record<MilestoneStatus, typeof Circle> = {
  not_started: Circle,
  in_progress: Clock,
  on_hold: PauseCircle,
  completed: CheckCircle2,
  cancelled: XCircle,
};

// Priority order for sorting
const PRIORITY_ORDER: Record<MilestonePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Status order for sorting
const STATUS_ORDER: Record<MilestoneStatus, number> = {
  in_progress: 0,
  not_started: 1,
  on_hold: 2,
  completed: 3,
  cancelled: 4,
};

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
  // State
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [zoomLevel, setZoomLevel] = useState(ZOOM_DEFAULT);
  const [showDependencies, setShowDependencies] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<GanttFilters>({
    status: [],
    priority: [],
    teamIds: [],
    dateRange: null,
  });
  const [sort, setSort] = useState<GanttSort>({
    sortBy: 'sortOrder',
    sortDirection: 'asc',
  });
  const [searchValue, setSearchValue] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<Record<string, PreviewDates>>({});
  const [dependencyCreation, setDependencyCreation] = useState<DependencyCreationState | null>(null);

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerContentRef = useRef<HTMLDivElement>(null);
  const wheelDeltaRef = useRef(0);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingZoomRef = useRef(ZOOM_DEFAULT);

  // Viewport state for virtualization
  const [viewport, setViewport] = useState({ scrollLeft: 0, scrollTop: 0, width: 0, height: 0 });

  // Visual scale for smooth zoom (CSS transform)
  const [visualScale, setVisualScale] = useState(1);

  // Calculate sub-column width and day width based on time period and zoom
  const { subColumnWidth, dayWidth } = useMemo(() => {
    const config = TIME_PERIOD_CONFIG[timePeriod];
    const t = (zoomLevel - 1) / (ZOOM_MAX - 1); // normalize to 0-1
    const scw = config.minSubColumnWidth + (config.maxSubColumnWidth - config.minSubColumnWidth) * t;
    const dw = scw / config.daysPerSubColumn;
    return { subColumnWidth: scw, dayWidth: dw };
  }, [timePeriod, zoomLevel]);

  // Calculate total timeline width
  const totalDays = differenceInDays(TIMELINE_END_DATE, TIMELINE_START_DATE) + 1;
  const timelineWidth = totalDays * dayWidth;

  // Convert milestones to include dependencies array
  const milestonesWithDeps: MilestoneWithDeps[] = useMemo(() => {
    return milestones.map((m) => ({
      ...m,
      dependencies: dependencies
        .filter((d) => d.successorId === m.id)
        .map((d) => ({ id: d.predecessorId })),
    }));
  }, [milestones, dependencies]);

  // Filter and sort milestones
  const filteredMilestones = useMemo(() => {
    let result = [...milestonesWithDeps];

    // Apply search filter
    if (searchValue) {
      const search = searchValue.toLowerCase();
      result = result.filter((m) =>
        m.title.toLowerCase().includes(search) ||
        m.description?.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (filters.status.length > 0) {
      result = result.filter((m) => filters.status.includes(m.status));
    }

    // Apply priority filter
    if (filters.priority.length > 0) {
      result = result.filter((m) => filters.priority.includes(m.priority));
    }

    // Apply team filter
    if (filters.teamIds.length > 0) {
      result = result.filter((m) => filters.teamIds.includes(m.teamId));
    }

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.sortBy) {
        case 'sortOrder':
          comparison = a.sortOrder - b.sortOrder;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'startDate':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'endDate':
          comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
        case 'priority':
          comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'status':
          comparison = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sort.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [milestonesWithDeps, searchValue, filters, sort]);

  // Calculate bar position for a milestone
  const getBarPosition = useCallback(
    (milestone: Milestone): BarPosition => {
      const preview = previewDates[milestone.id];
      const startDate = preview ? preview.startDate : toLocalMidnight(milestone.startDate);
      const endDate = preview ? preview.endDate : toLocalMidnight(milestone.endDate);

      const left = differenceInDays(startDate, TIMELINE_START_DATE) * dayWidth;
      const width = Math.max(MIN_BAR_WIDTH, (differenceInDays(endDate, startDate) + 1) * dayWidth);

      return { left, width };
    },
    [dayWidth, previewDates]
  );

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (!timelineRef.current) return;
    const today = new Date();
    const daysFromStart = differenceInDays(today, TIMELINE_START_DATE);
    const scrollPosition = daysFromStart * dayWidth - timelineRef.current.clientWidth / 2;
    timelineRef.current.scrollLeft = Math.max(0, scrollPosition);
  }, [dayWidth]);

  // Scroll to today on mount
  useEffect(() => {
    scrollToToday();
  }, [scrollToToday]);

  // Sync sidebar and timeline scroll + update viewport for virtualization
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarRef.current) {
      sidebarRef.current.scrollTop = timelineRef.current.scrollTop;
    }
    // Sync header scroll
    if (timelineRef.current && headerRef.current) {
      headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
    }
    // Update viewport for virtualization
    if (timelineRef.current) {
      const { scrollLeft, scrollTop, clientWidth, clientHeight } = timelineRef.current;
      setViewport({ scrollLeft, scrollTop, width: clientWidth, height: clientHeight });
    }
  }, []);

  const handleSidebarScroll = useCallback(() => {
    if (timelineRef.current && sidebarRef.current) {
      timelineRef.current.scrollTop = sidebarRef.current.scrollTop;
    }
  }, []);

  // Initialize viewport dimensions
  useLayoutEffect(() => {
    if (timelineRef.current) {
      const { scrollLeft, scrollTop, clientWidth, clientHeight } = timelineRef.current;
      setViewport({ scrollLeft, scrollTop, width: clientWidth, height: clientHeight });
    }
  }, []);

  // Handle wheel events - Ctrl/Cmd + wheel = zoom, plain wheel = horizontal scroll
  // Uses CSS transform for instant visual feedback, debounces actual zoom changes
  const WHEEL_THRESHOLD = 100; // ~1 mouse wheel notch
  const ZOOM_DEBOUNCE_MS = 150; // Wait this long after last wheel event to apply zoom

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        // Accumulate wheel delta
        wheelDeltaRef.current += e.deltaY;

        // Check if we've crossed the threshold for a zoom step
        if (Math.abs(wheelDeltaRef.current) >= WHEEL_THRESHOLD) {
          const steps = Math.trunc(wheelDeltaRef.current / WHEEL_THRESHOLD);
          wheelDeltaRef.current -= steps * WHEEL_THRESHOLD;

          // Update pending zoom level
          pendingZoomRef.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pendingZoomRef.current - steps));

          // Calculate visual scale relative to current zoom
          const currentConfig = TIME_PERIOD_CONFIG[timePeriod];
          const currentT = (zoomLevel - 1) / (ZOOM_MAX - 1);
          const currentWidth = currentConfig.minSubColumnWidth + (currentConfig.maxSubColumnWidth - currentConfig.minSubColumnWidth) * currentT;

          const pendingT = (pendingZoomRef.current - 1) / (ZOOM_MAX - 1);
          const pendingWidth = currentConfig.minSubColumnWidth + (currentConfig.maxSubColumnWidth - currentConfig.minSubColumnWidth) * pendingT;

          setVisualScale(pendingWidth / currentWidth);

          // Debounce the actual zoom level change
          if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
          }
          zoomTimeoutRef.current = setTimeout(() => {
            setZoomLevel(pendingZoomRef.current);
            setVisualScale(1);
          }, ZOOM_DEBOUNCE_MS);
        }
      } else if (timelineRef.current) {
        // Horizontal scroll with plain wheel
        e.preventDefault();
        timelineRef.current.scrollLeft += e.deltaY;
      }
    },
    [zoomLevel, timePeriod]
  );

  // Sync pendingZoomRef when zoomLevel changes (e.g., from toolbar buttons)
  useEffect(() => {
    pendingZoomRef.current = zoomLevel;
  }, [zoomLevel]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, []);

  // Drag handlers
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, milestone: Milestone, type: DragType) => {
      if (!type) return;

      const pos = getBarPosition(milestone);
      const scrollLeft = timelineRef.current?.scrollLeft || 0;

      setDragState({
        type,
        milestoneId: milestone.id,
        initialMouseX: e.clientX,
        initialLeft: pos.left,
        initialWidth: pos.width,
        initialStartDate: toLocalMidnight(milestone.startDate),
        initialEndDate: toLocalMidnight(milestone.endDate),
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

      // Check if user has moved enough to consider it a drag
      if (!dragState.hasMoved && Math.abs(mouseDelta) < 5) return;

      if (!dragState.hasMoved) {
        setDragState({ ...dragState, hasMoved: true });
      }

      const daysDelta = Math.round(mouseDelta / dayWidth);

      let newStartDate: Date;
      let newEndDate: Date;

      if (dragState.type === 'move') {
        newStartDate = addDays(dragState.initialStartDate, daysDelta);
        newEndDate = addDays(dragState.initialEndDate, daysDelta);

        // Clamp move to stay within timeline bounds
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
      } else if (dragState.type === 'resize-start') {
        newStartDate = addDays(dragState.initialStartDate, daysDelta);
        newEndDate = dragState.initialEndDate;
        // Don't allow start to go past end
        if (newStartDate > newEndDate) {
          newStartDate = newEndDate;
        }
        // Clamp to timeline start
        if (newStartDate < TIMELINE_START_DATE) {
          newStartDate = TIMELINE_START_DATE;
        }
      } else {
        // resize-end
        newStartDate = dragState.initialStartDate;
        newEndDate = addDays(dragState.initialEndDate, daysDelta);
        // Don't allow end to go before start
        if (newEndDate < newStartDate) {
          newEndDate = newStartDate;
        }
        // Clamp to timeline end
        if (newEndDate > TIMELINE_END_DATE) {
          newEndDate = TIMELINE_END_DATE;
        }
      }

      setPreviewDates({
        ...previewDates,
        [dragState.milestoneId]: { startDate: newStartDate, endDate: newEndDate },
      });
    },
    [dragState, dayWidth, previewDates]
  );

  const handleMouseUp = useCallback(async () => {
    if (!dragState) return;

    const preview = previewDates[dragState.milestoneId];

    // If the user didn't actually move, treat as a click
    if (!dragState.hasMoved) {
      const milestone = filteredMilestones.find((m) => m.id === dragState.milestoneId);
      if (milestone) {
        onEdit(milestone);
      }
      setDragState(null);
      return;
    }

    // If there are preview dates, save them
    if (preview) {
      await onUpdateDates(dragState.milestoneId, preview.startDate, preview.endDate);
    }

    // Clear state
    setDragState(null);
    setPreviewDates((prev) => {
      const next = { ...prev };
      delete next[dragState.milestoneId];
      return next;
    });
  }, [dragState, previewDates, filteredMilestones, onEdit, onUpdateDates]);

  // Set up global mouse listeners for drag
  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Dependency creation handlers
  const handleDependencyDragStart = useCallback(
    (e: React.MouseEvent, milestone: Milestone, side: ConnectionSide) => {
      const pos = getBarPosition(milestone);
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;

      const milestoneIndex = filteredMilestones.findIndex((m) => m.id === milestone.id);
      const fromX = side === 'start' ? pos.left : pos.left + pos.width;
      const fromY = milestoneIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

      setDependencyCreation({
        fromMilestoneId: milestone.id,
        fromSide: side,
        fromX,
        fromY,
        currentX: fromX,
        currentY: fromY,
      });
    },
    [getBarPosition, filteredMilestones]
  );

  const handleDependencyMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dependencyCreation || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const scrollTop = timelineRef.current.scrollTop;

      setDependencyCreation({
        ...dependencyCreation,
        currentX: e.clientX - rect.left + scrollLeft,
        currentY: e.clientY - rect.top + scrollTop,
      });
    },
    [dependencyCreation]
  );

  const handleDependencyMouseUp = useCallback(
    async (e: MouseEvent) => {
      if (!dependencyCreation || !timelineRef.current) {
        setDependencyCreation(null);
        return;
      }

      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const scrollTop = timelineRef.current.scrollTop;
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;

      // Find the milestone at the drop position
      const rowIndex = Math.floor(y / ROW_HEIGHT);
      const targetMilestone = filteredMilestones[rowIndex];

      if (targetMilestone && targetMilestone.id !== dependencyCreation.fromMilestoneId) {
        // Create dependency: from milestone's end connects to target milestone's start
        // predecessorId = from milestone, successorId = target milestone
        await onCreateDependency(dependencyCreation.fromMilestoneId, targetMilestone.id);
      }

      setDependencyCreation(null);
    },
    [dependencyCreation, filteredMilestones, onCreateDependency]
  );

  // Set up dependency creation listeners
  useEffect(() => {
    if (dependencyCreation) {
      window.addEventListener('mousemove', handleDependencyMouseMove);
      window.addEventListener('mouseup', handleDependencyMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleDependencyMouseMove);
        window.removeEventListener('mouseup', handleDependencyMouseUp);
      };
    }
  }, [dependencyCreation, handleDependencyMouseMove, handleDependencyMouseUp]);

  // Handle dependency line click (delete)
  const handleDependencyClick = useCallback(
    async (fromId: string, toId: string) => {
      // Find the dependency to delete
      const dep = dependencies.find(
        (d) => d.predecessorId === fromId && d.successorId === toId
      );
      if (dep) {
        await onDeleteDependency(dep.id);
      }
    },
    [dependencies, onDeleteDependency]
  );

  // Generate timeline header cells
  // Generate header cells only for visible range (ClickUp-style: group row + sub-column row)
  // This is computed based on viewport, not the entire timeline
  const headerCells = useMemo(() => {
    interface GroupCell {
      date: Date;
      labelLeft: string;
      labelRight: string;
      left: number;
      width: number;
    }
    interface SubColumnCell {
      date: Date;
      left: number;
      width: number;
      isToday: boolean;
      isWeekend: boolean;
    }

    // Calculate visible date range based on viewport with generous buffer
    const buffer = 500; // pixels
    const viewLeft = Math.max(0, viewport.scrollLeft - buffer);
    const viewRight = viewport.scrollLeft + viewport.width + buffer;

    // Convert pixel positions to day offsets
    const startDayOffset = Math.max(0, Math.floor(viewLeft / dayWidth));
    const endDayOffset = Math.min(
      differenceInDays(TIMELINE_END_DATE, TIMELINE_START_DATE),
      Math.ceil(viewRight / dayWidth)
    );

    // Get date range for visible area
    const visibleStart = addDays(TIMELINE_START_DATE, startDayOffset);
    const visibleEnd = addDays(TIMELINE_START_DATE, endDayOffset);

    const groupCells: GroupCell[] = [];
    const subColumnCells: SubColumnCell[] = [];
    const today = new Date();

    switch (timePeriod) {
      case 'week': {
        // Group = weeks, Sub-column = days
        const weeks = eachWeekOfInterval({ start: visibleStart, end: visibleEnd }, { weekStartsOn: 0 });
        weeks.forEach((weekStart) => {
          const clampedStart = weekStart < TIMELINE_START_DATE ? TIMELINE_START_DATE : weekStart;
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
          const clampedEnd = weekEnd > TIMELINE_END_DATE ? TIMELINE_END_DATE : weekEnd;

          const left = differenceInDays(clampedStart, TIMELINE_START_DATE) * dayWidth;
          const width = (differenceInDays(clampedEnd, clampedStart) + 1) * dayWidth;

          const dateRange = `${format(clampedStart, 'MMM d')}-${format(clampedEnd, 'd')}`;
          groupCells.push({
            date: weekStart,
            labelLeft: dateRange,
            labelRight: `W${format(weekStart, 'w')}`,
            left,
            width,
          });

          // Sub-columns: individual days
          const days = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
          days.forEach((day) => {
            const dayLeft = differenceInDays(day, TIMELINE_START_DATE) * dayWidth;
            subColumnCells.push({
              date: day,
              left: dayLeft,
              width: subColumnWidth,
              isToday: isSameDay(day, today),
              isWeekend: isWeekend(day),
            });
          });
        });
        break;
      }

      case 'month': {
        // Group = months, Sub-column = weeks
        const months = eachMonthOfInterval({ start: visibleStart, end: visibleEnd });
        months.forEach((monthStart) => {
          const clampedStart = monthStart < TIMELINE_START_DATE ? TIMELINE_START_DATE : monthStart;
          const monthEnd = endOfMonth(monthStart);
          const clampedEnd = monthEnd > TIMELINE_END_DATE ? TIMELINE_END_DATE : monthEnd;

          const left = differenceInDays(clampedStart, TIMELINE_START_DATE) * dayWidth;
          const width = (differenceInDays(clampedEnd, clampedStart) + 1) * dayWidth;

          groupCells.push({
            date: monthStart,
            labelLeft: format(monthStart, 'MMM'),
            labelRight: format(monthStart, 'yyyy'),
            left,
            width,
          });

          // Sub-columns: weeks within this month
          const weeks = eachWeekOfInterval({ start: clampedStart, end: clampedEnd }, { weekStartsOn: 0 });
          weeks.forEach((weekStart) => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
            const displayStart = weekStart < clampedStart ? clampedStart : weekStart;
            const displayEnd = weekEnd > clampedEnd ? clampedEnd : weekEnd;

            const weekLeft = differenceInDays(displayStart, TIMELINE_START_DATE) * dayWidth;
            const weekWidth = (differenceInDays(displayEnd, displayStart) + 1) * dayWidth;
            const hasToday = today >= displayStart && today <= displayEnd;

            subColumnCells.push({
              date: weekStart,
              left: weekLeft,
              width: weekWidth,
              isToday: hasToday,
              isWeekend: false,
            });
          });
        });
        break;
      }

      case 'quarter': {
        // Group = quarters, Sub-column = months
        const quarters = eachQuarterOfInterval({ start: visibleStart, end: visibleEnd });
        quarters.forEach((quarterStart) => {
          const clampedStart = quarterStart < TIMELINE_START_DATE ? TIMELINE_START_DATE : quarterStart;
          const quarterEnd = endOfQuarter(quarterStart);
          const clampedEnd = quarterEnd > TIMELINE_END_DATE ? TIMELINE_END_DATE : quarterEnd;

          const left = differenceInDays(clampedStart, TIMELINE_START_DATE) * dayWidth;
          const width = (differenceInDays(clampedEnd, clampedStart) + 1) * dayWidth;

          groupCells.push({
            date: quarterStart,
            labelLeft: `Q${format(quarterStart, 'Q')}`,
            labelRight: format(quarterStart, 'yyyy'),
            left,
            width,
          });

          // Sub-columns: months within this quarter
          const months = eachMonthOfInterval({ start: clampedStart, end: clampedEnd });
          months.forEach((monthStart) => {
            const monthEnd = endOfMonth(monthStart);
            const displayEnd = monthEnd > clampedEnd ? clampedEnd : monthEnd;

            const monthLeft = differenceInDays(monthStart, TIMELINE_START_DATE) * dayWidth;
            const monthWidth = (differenceInDays(displayEnd, monthStart) + 1) * dayWidth;
            const hasToday = today >= monthStart && today <= displayEnd;

            subColumnCells.push({
              date: monthStart,
              left: monthLeft,
              width: monthWidth,
              isToday: hasToday,
              isWeekend: false,
            });
          });
        });
        break;
      }

      case 'year': {
        // Group = years, Sub-column = quarters
        const years = eachYearOfInterval({ start: visibleStart, end: visibleEnd });
        years.forEach((yearStart) => {
          const clampedStart = yearStart < TIMELINE_START_DATE ? TIMELINE_START_DATE : yearStart;
          const yearEnd = endOfYear(yearStart);
          const clampedEnd = yearEnd > TIMELINE_END_DATE ? TIMELINE_END_DATE : yearEnd;

          const left = differenceInDays(clampedStart, TIMELINE_START_DATE) * dayWidth;
          const width = (differenceInDays(clampedEnd, clampedStart) + 1) * dayWidth;

          groupCells.push({
            date: yearStart,
            labelLeft: format(yearStart, 'yyyy'),
            labelRight: '',
            left,
            width,
          });

          // Sub-columns: quarters within this year
          const quarters = eachQuarterOfInterval({ start: clampedStart, end: clampedEnd });
          quarters.forEach((quarterStart) => {
            const quarterEnd = endOfQuarter(quarterStart);
            const displayEnd = quarterEnd > clampedEnd ? clampedEnd : quarterEnd;

            const quarterLeft = differenceInDays(quarterStart, TIMELINE_START_DATE) * dayWidth;
            const quarterWidth = (differenceInDays(displayEnd, quarterStart) + 1) * dayWidth;
            const hasToday = today >= quarterStart && today <= displayEnd;

            subColumnCells.push({
              date: quarterStart,
              left: quarterLeft,
              width: quarterWidth,
              isToday: hasToday,
              isWeekend: false,
            });
          });
        });
        break;
      }
    }

    return { groupCells, subColumnCells };
  }, [timePeriod, dayWidth, subColumnWidth, viewport.scrollLeft, viewport.width]);

  // Cells are already filtered to visible range in headerCells
  const visibleCells = headerCells;

  // Virtualized milestones - only render visible rows
  const visibleMilestones = useMemo(() => {
    const viewTop = viewport.scrollTop - VIRTUALIZATION_BUFFER;
    const viewBottom = viewport.scrollTop + viewport.height + VIRTUALIZATION_BUFFER;

    return filteredMilestones
      .map((milestone, index) => ({ milestone, index }))
      .filter(({ index }) => {
        const top = index * ROW_HEIGHT;
        const bottom = top + ROW_HEIGHT;
        return bottom >= viewTop && top <= viewBottom;
      });
  }, [filteredMilestones, viewport.scrollTop, viewport.height]);

  // Content height
  const contentHeight = Math.max(filteredMilestones.length * ROW_HEIGHT, 400);

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <GanttToolbar
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
        zoomLevel={zoomLevel}
        onZoomIn={() => setZoomLevel((prev) => Math.min(ZOOM_MAX, prev + 1))}
        onZoomOut={() => setZoomLevel((prev) => Math.max(ZOOM_MIN, prev - 1))}
        showDependencies={showDependencies}
        onToggleDependencies={() => setShowDependencies(!showDependencies)}
        onScrollToToday={scrollToToday}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        teams={teams}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <div
            className="flex flex-col border-r border-border bg-background"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Sidebar header */}
            <div
              className="flex items-center px-3 border-b border-border bg-muted/50"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {filteredMilestones.length} Milestones
              </span>
            </div>

            {/* Sidebar content */}
            <div
              ref={sidebarRef}
              className="flex-1 overflow-y-auto overflow-x-hidden"
              onScroll={handleSidebarScroll}
            >
              {filteredMilestones.map((milestone) => {
                const StatusIcon = STATUS_ICONS[milestone.status];
                const statusConfig = STATUS_CONFIG[milestone.status];
                const team = teams.find((t) => t.id === milestone.teamId);

                return (
                  <MilestoneContextMenu
                    key={milestone.id}
                    milestone={milestone}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onPriorityChange={onPriorityChange}
                    canEdit={true}
                  >
                    <div
                      className="flex items-center px-3 border-b border-border/50 hover:bg-muted/50 cursor-pointer group"
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onEdit(milestone)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                        <StatusIcon
                          className="h-3.5 w-3.5 flex-shrink-0"
                          style={{ color: statusConfig.bgColor }}
                        />
                        <span className="text-sm truncate">{milestone.title}</span>
                      </div>
                      {team && (
                        <div
                          className="h-2 w-2 rounded-full flex-shrink-0 ml-2"
                          style={{ backgroundColor: team.color }}
                          title={team.name}
                        />
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 ml-1 flex-shrink-0" />
                    </div>
                  </MilestoneContextMenu>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline header - scrolls with body */}
          <div
            ref={headerRef}
            className="flex-shrink-0 border-b border-border bg-muted/30 overflow-hidden"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              ref={headerContentRef}
              className="relative h-full"
              style={{
                width: timelineWidth,
                transform: visualScale !== 1 ? `scaleX(${visualScale})` : undefined,
                transformOrigin: 'left center',
              }}
            >
              {/* Group header row (top) - virtualized */}
              <div className="h-7 border-b border-border/50 relative bg-muted/30">
                {visibleCells.groupCells.map((cell) => (
                  <div
                    key={`group-${cell.date.getTime()}`}
                    className="absolute flex items-center justify-between px-2 text-xs font-medium border-r border-border/30"
                    style={{ left: cell.left, width: cell.width, height: 28 }}
                  >
                    <span className="truncate">{cell.labelLeft}</span>
                    {cell.labelRight && (
                      <span className="text-muted-foreground ml-1 flex-shrink-0">{cell.labelRight}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Sub-column header row (bottom) - virtualized */}
              <div className="h-7 relative">
                {visibleCells.subColumnCells.map((cell) => {
                  // Compute labels at render time based on time period and zoom
                  const useShortLabels = zoomLevel <= 2;
                  let labelLeft = '';
                  let labelRight = '';

                  if (timePeriod === 'week') {
                    // Days: "Su 25" or just "25"
                    labelLeft = useShortLabels
                      ? format(cell.date, 'd')
                      : `${format(cell.date, 'EEEEE')} ${format(cell.date, 'd')}`;
                  } else if (timePeriod === 'month') {
                    // Weeks: "1-7" | "W6"
                    const weekEnd = endOfWeek(cell.date, { weekStartsOn: 0 });
                    labelLeft = `${format(cell.date, 'd')}-${format(weekEnd, 'd')}`;
                    labelRight = `W${format(cell.date, 'w')}`;
                  } else if (timePeriod === 'quarter') {
                    // Months: "Jan"
                    labelLeft = format(cell.date, 'MMM');
                  } else if (timePeriod === 'year') {
                    // Quarters: "Q1"
                    labelLeft = `Q${format(cell.date, 'Q')}`;
                  }

                  return (
                    <div
                      key={`sub-${cell.date.getTime()}`}
                      className={cn(
                        'absolute flex items-center text-xs border-r border-border/20 overflow-hidden',
                        labelRight ? 'justify-between px-1' : 'justify-center',
                        cell.isToday && 'bg-primary/10 font-semibold text-primary',
                        cell.isWeekend && !cell.isToday && 'bg-muted/30'
                      )}
                      style={{
                        left: cell.left,
                        width: cell.width,
                        height: 28,
                      }}
                    >
                      <span className="truncate">{labelLeft}</span>
                      {labelRight && (
                        <span className="text-muted-foreground text-[10px] flex-shrink-0">{labelRight}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Timeline body - handles Ctrl/Cmd + wheel for zoom */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-auto"
            onScroll={handleTimelineScroll}
            onWheel={handleWheel}
          >
            <div
              ref={contentRef}
              className="relative"
              style={{
                width: timelineWidth,
                height: contentHeight,
                transform: visualScale !== 1 ? `scaleX(${visualScale})` : undefined,
                transformOrigin: 'left top',
              }}
            >
              {/* Sub-column grid lines */}
              {visibleCells.subColumnCells.map((cell) => (
                <div
                  key={`grid-${cell.date.getTime()}`}
                  className={cn(
                    'absolute top-0 bottom-0 border-r border-border/20',
                    cell.isWeekend && 'bg-muted/20'
                  )}
                  style={{ left: cell.left, width: cell.width }}
                />
              ))}

              {/* Group boundary lines (darker) */}
              {visibleCells.groupCells.map((cell) => (
                <div
                  key={`group-grid-${cell.date.getTime()}`}
                  className="absolute top-0 bottom-0 border-r border-border/40"
                  style={{ left: cell.left + cell.width - 1 }}
                />
              ))}

              {/* Today line */}
              {(() => {
                const today = new Date();
                if (today >= TIMELINE_START_DATE && today <= TIMELINE_END_DATE) {
                  const todayLeft = differenceInDays(today, TIMELINE_START_DATE) * dayWidth;
                  return (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                      style={{ left: todayLeft }}
                    />
                  );
                }
                return null;
              })()}

              {/* Row backgrounds - virtualized */}
              {visibleMilestones.map(({ index }) => (
                <div
                  key={`row-${index}`}
                  className="absolute left-0 right-0 border-b border-border/30"
                  style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              {/* Dependency lines - uses all milestones for accurate paths */}
              {showDependencies && (
                <DependencyLines
                  milestones={filteredMilestones}
                  getBarPosition={getBarPosition}
                  rowHeight={ROW_HEIGHT}
                  onDependencyClick={handleDependencyClick}
                  creationState={dependencyCreation}
                />
              )}

              {/* Milestone bars - virtualized */}
              {visibleMilestones.map(({ milestone, index }) => {
                const pos = getBarPosition(milestone);
                const isDragging = dragState?.milestoneId === milestone.id && dragState.hasMoved;

                return (
                  <div
                    key={milestone.id}
                    className="absolute left-0 right-0"
                    style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                  >
                    <GanttBar
                      milestone={milestone}
                      left={pos.left}
                      width={pos.width}
                      isDragging={isDragging}
                      isEditable={true}
                      onMouseDown={(e, type) => handleBarMouseDown(e, milestone, type)}
                      onClick={() => onEdit(milestone)}
                      onDependencyDragStart={(e, side) => handleDependencyDragStart(e, milestone, side)}
                      showConnectionHandles={showDependencies}
                    />
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
