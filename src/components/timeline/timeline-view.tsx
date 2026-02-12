'use client';

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { startOfDay, addDays, addMonths, subMonths, differenceInDays } from 'date-fns';
import { Plus, Minus, GitBranch, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TodayMarker } from './today-marker';
import { CursorMarker } from './cursor-marker';
import { TimelineGrid } from './timeline-grid';
import { TimelineChart, type TimelineChartHandle } from './timeline-chart';
import {
  milestoneToTimelineTask,
  milestonesToTimelineTasksWithTeamTracks,
  dependencyToTimelineLink,
  toLocalMidnight,
  isTeamTrackId,
  parseTeamTrackId,
} from './transformers';
import { ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import { getPixelsPerDay, dateToPixel, getTotalWidth } from './date-math';
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from './constants';
import { useTimelineStore } from '@/store/timeline-store';
import { reflowProject, type ReflowMilestone, type ReflowDependency } from '@/lib/reflow';
import { useBarDrag } from './use-bar-drag';
import { useDragLink } from './use-drag-link';
import { useLinkDelete } from './use-link-delete';
import type { CascadedUpdate } from '@/hooks/use-milestones';
import type { TimePeriod, TimelineTask, TimelineLink } from './types';
import type { Milestone, MilestoneDependency, MilestoneStatus, MilestonePriority, Team, Project, TeamMilestoneDuration } from '@/db/schema';

const ADD_FEATURE_TASK_ID = '__add_feature__';

const WINDOW_PADDING: Record<TimePeriod, number> = {
  week: 3,
  month: 6,
  quarter: 12,
  year: 24,
};
const EXPANSION_CHUNK: Record<TimePeriod, number> = {
  week: 2,
  month: 4,
  quarter: 6,
  year: 12,
};

function computeInitialWindow(
  features: Milestone[],
  timePeriod: TimePeriod,
): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const padding = WINDOW_PADDING[timePeriod];
  let minDate = today;
  let maxDate = today;
  for (const f of features) {
    const s = toLocalMidnight(f.startDate);
    const e = toLocalMidnight(f.endDate);
    if (s < minDate) minDate = s;
    if (e > maxDate) maxDate = e;
  }
  const start = subMonths(minDate, padding);
  const end = addMonths(maxDate, padding);
  return {
    start: start < TIMELINE_START_DATE ? TIMELINE_START_DATE : start,
    end: end > TIMELINE_END_DATE ? TIMELINE_END_DATE : end,
  };
}

const ZOOM_CONFIG: Record<TimePeriod, { min: number; max: number }> = {
  week: { min: 30, max: 120 },
  month: { min: 60, max: 180 },
  quarter: { min: 60, max: 220 },
  year: { min: 60, max: 220 },
};

interface TimelineViewProps {
  project: Project;
  allProjects?: Project[];
  onProjectChange?: (id: string) => void;
  features: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  teamDurations?: TeamMilestoneDuration[];
  onBack: () => void;
  onEdit: (feature: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (id: string, startDate: Date, endDate: Date, duration?: number) => Promise<CascadedUpdate[]>;
  onUpdateTeamDuration?: (milestoneId: string, teamId: string, duration: number) => Promise<void>;
  onStatusChange: (id: string, status: MilestoneStatus) => Promise<void>;
  onPriorityChange?: (id: string, priority: MilestonePriority) => Promise<void>;
  onAddFeature: () => void;
  onCreateDependency: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency: (id: string) => Promise<void>;
}

export function TimelineView({
  project,
  allProjects,
  onProjectChange,
  features,
  dependencies,
  teams,
  teamDurations = [],
  onBack,
  onEdit,
  onUpdateDates,
  onUpdateTeamDuration,
  onAddFeature,
  onStatusChange,
  onCreateDependency,
  onDeleteDependency,
}: TimelineViewProps) {
  const timePeriod = useTimelineStore((s) => s.getMilestoneTimePeriod(project.id)) as TimePeriod;
  const setMilestoneTimePeriod = useTimelineStore((s) => s.setMilestoneTimePeriod);
  const periodChangeDateRef = useRef<Date | null>(null);

  const setTimePeriod = useCallback(
    (period: TimePeriod) => {
      // Capture center date before changing period
      const chartHandle = chartRef.current;
      const scrollEl = chartHandle?.scrollRef;
      if (scrollEl) {
        const centerX = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
        const ppd = pixelsPerDayRef.current;
        if (ppd > 0) {
          periodChangeDateRef.current = addDays(windowStartRef.current, Math.round(centerX / ppd));
        }
      }
      setMilestoneTimePeriod(project.id, period);
    },
    [project.id, setMilestoneTimePeriod]
  );

  const [zoomLevel, setZoomLevel] = useState(5);
  const [showDependencies, setShowDependencies] = useState(true);

  const chartRef = useRef<TimelineChartHandle>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  const dependenciesRef = useRef(dependencies);
  dependenciesRef.current = dependencies;
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const onUpdateDatesRef = useRef(onUpdateDates);
  onUpdateDatesRef.current = onUpdateDates;
  const onAddFeatureRef = useRef(onAddFeature);
  onAddFeatureRef.current = onAddFeature;
  const onCreateDependencyRef = useRef(onCreateDependency);
  onCreateDependencyRef.current = onCreateDependency;
  const onDeleteDependencyRef = useRef(onDeleteDependency);
  onDeleteDependencyRef.current = onDeleteDependency;
  const onUpdateTeamDurationRef = useRef(onUpdateTeamDuration);
  onUpdateTeamDurationRef.current = onUpdateTeamDuration;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const setGridColumnWidth = useTimelineStore((s) => s.setGridColumnWidth);
  const storeGridColumnWidth = useTimelineStore((s) => s.gridColumnWidth);
  const storeGridColumnWidthRef = useRef(storeGridColumnWidth);
  storeGridColumnWidthRef.current = storeGridColumnWidth;

  const gridScrollRef = useRef<HTMLDivElement>(null);

  const visibleTeamIds = useTimelineStore((s) => s.visibleTeamIds);
  const setVisibleTeamIds = useTimelineStore((s) => s.setVisibleTeamIds);
  const toggleTeamVisibility = useTimelineStore((s) => s.toggleTeamVisibility);

  const prevTeamIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentTeamIds = teams.map((t) => t.id);
    const prevIds = prevTeamIdsRef.current;
    prevTeamIdsRef.current = currentTeamIds;
    if (currentTeamIds.length > 0 && visibleTeamIds.length === 0) {
      setVisibleTeamIds(currentTeamIds);
      return;
    }
    const newTeamIds = currentTeamIds.filter((id) => !prevIds.includes(id));
    if (newTeamIds.length > 0) {
      setVisibleTeamIds([...visibleTeamIds, ...newTeamIds]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  // --- Timeline windowing ---
  const [windowStart, setWindowStart] = useState<Date>(() => computeInitialWindow(features, timePeriod).start);
  const [windowEnd, setWindowEnd] = useState<Date>(() => computeInitialWindow(features, timePeriod).end);

  const windowStartRef = useRef(windowStart);
  windowStartRef.current = windowStart;
  const windowEndRef = useRef(windowEnd);
  windowEndRef.current = windowEnd;
  const timePeriodRef = useRef(timePeriod);
  timePeriodRef.current = timePeriod;

  const isExpandingRef = useRef(false);
  const scrollAdjustRef = useRef<{ oldStart: Date; oldScrollLeft: number } | null>(null);

  // Reset window when time period changes
  const prevTimePeriodRef = useRef(timePeriod);
  useEffect(() => {
    if (prevTimePeriodRef.current !== timePeriod) {
      prevTimePeriodRef.current = timePeriod;
      const w = computeInitialWindow(features, timePeriod);
      setWindowStart(w.start);
      setWindowEnd(w.end);

      const targetDate = periodChangeDateRef.current;
      if (targetDate) {
        periodChangeDateRef.current = null;
        requestAnimationFrame(() => {
          scrollToDate(targetDate);
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod]);

  // Auto-expand window if any feature falls outside
  useEffect(() => {
    let newStart = windowStart;
    let newEnd = windowEnd;
    let changed = false;
    for (const f of features) {
      const s = toLocalMidnight(f.startDate);
      const e = toLocalMidnight(f.endDate);
      if (s < newStart) { newStart = subMonths(s, 1); changed = true; }
      if (e > newEnd) { newEnd = addMonths(e, 1); changed = true; }
    }
    if (changed) {
      if (newStart < TIMELINE_START_DATE) newStart = TIMELINE_START_DATE;
      if (newEnd > TIMELINE_END_DATE) newEnd = TIMELINE_END_DATE;
      setWindowStart(newStart);
      setWindowEnd(newEnd);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features]);

  // Scroll handler for edge-based expansion
  const handleChartScroll = useCallback((scrollLeft: number, _scrollTop: number) => {
    if (isExpandingRef.current) return;
    const scrollEl = chartRef.current?.scrollRef;
    if (!scrollEl) return;
    const { scrollWidth, clientWidth } = scrollEl;
    const threshold = clientWidth;

    let expandLeft = false;
    let expandRight = false;

    if (scrollLeft < threshold && windowStartRef.current > TIMELINE_START_DATE) {
      expandLeft = true;
    }
    if (scrollLeft + clientWidth > scrollWidth - threshold && windowEndRef.current < TIMELINE_END_DATE) {
      expandRight = true;
    }

    if (!expandLeft && !expandRight) return;
    isExpandingRef.current = true;

    if (expandLeft) {
      scrollAdjustRef.current = {
        oldStart: windowStartRef.current,
        oldScrollLeft: scrollLeft,
      };
      setWindowStart((prev) => {
        const chunk = EXPANSION_CHUNK[timePeriodRef.current];
        const next = subMonths(prev, chunk);
        return next < TIMELINE_START_DATE ? TIMELINE_START_DATE : next;
      });
    }
    if (expandRight) {
      setWindowEnd((prev) => {
        const chunk = EXPANSION_CHUNK[timePeriodRef.current];
        const next = addMonths(prev, chunk);
        return next > TIMELINE_END_DATE ? TIMELINE_END_DATE : next;
      });
    }
  }, []);

  // After window change, preserve scroll position
  const prevWindowRef = useRef({ start: windowStart, end: windowEnd });
  useEffect(() => {
    const prev = prevWindowRef.current;
    prevWindowRef.current = { start: windowStart, end: windowEnd };

    const adj = scrollAdjustRef.current;
    if (adj && windowStart < prev.start) {
      scrollAdjustRef.current = null;
      requestAnimationFrame(() => {
        const ppd = pixelsPerDayRef.current;
        const addedDays = differenceInDays(adj.oldStart, windowStart);
        const addedPixels = Math.round(addedDays * ppd);
        const scrollEl = chartRef.current?.scrollRef;
        if (scrollEl && addedPixels > 0) {
          scrollEl.scrollLeft = adj.oldScrollLeft + addedPixels;
        }
        isExpandingRef.current = false;
      });
    } else {
      isExpandingRef.current = false;
    }
  }, [windowStart, windowEnd]);

  // Zoom anchoring
  const zoomAnchorRef = useRef<{ dayOffset: number; viewportX: number } | null>(null);
  const zoomAnchorClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const captureViewportCenterAnchor = useCallback(() => {
    const scrollEl = chartRef.current?.scrollRef;
    if (!scrollEl) return;
    const viewportX = scrollEl.clientWidth / 2;
    const absoluteX = viewportX + scrollEl.scrollLeft;
    const ppd = pixelsPerDayRef.current;
    if (ppd > 0) {
      const dayOffset = absoluteX / ppd;
      zoomAnchorRef.current = { dayOffset, viewportX };
    }
    if (zoomAnchorClearRef.current) clearTimeout(zoomAnchorClearRef.current);
    zoomAnchorClearRef.current = setTimeout(() => {
      zoomAnchorRef.current = null;
      zoomAnchorClearRef.current = null;
    }, 500);
  }, []);

  // Sort and transform features
  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }, [features]);

  const hasTeamTracks = teamDurations.length > 0;

  const tasks: TimelineTask[] = useMemo(() => {
    let featureTasks: TimelineTask[];

    if (hasTeamTracks && visibleTeamIds.length > 0) {
      featureTasks = milestonesToTimelineTasksWithTeamTracks(
        sortedFeatures,
        teamDurations,
        teams,
        visibleTeamIds
      );
    } else {
      featureTasks = sortedFeatures.map(milestoneToTimelineTask);
    }

    featureTasks.push({
      id: ADD_FEATURE_TASK_ID,
      text: '',
      startDate: TIMELINE_START_DATE,
      endDate: TIMELINE_START_DATE,
      duration: 0,
      durationText: '',
      type: 'task',
    });
    return featureTasks;
  }, [sortedFeatures, hasTeamTracks, teamDurations, teams, visibleTeamIds]);

  const links: TimelineLink[] = useMemo(() => {
    if (!showDependencies) return [];
    const featureIds = new Set(sortedFeatures.map((f) => f.id));
    return dependencies
      .filter((d) => featureIds.has(d.predecessorId) && featureIds.has(d.successorId))
      .map(dependencyToTimelineLink);
  }, [showDependencies, dependencies, sortedFeatures]);

  const featureMap = useMemo(() => {
    const map = new Map<string, Milestone>();
    features.forEach((f) => map.set(f.id, f));
    return map;
  }, [features]);
  const featureMapRef = useRef(featureMap);
  featureMapRef.current = featureMap;

  const predecessorMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dep of dependencies) {
      const list = map.get(dep.successorId) || [];
      list.push(dep.predecessorId);
      map.set(dep.successorId, list);
    }
    return map;
  }, [dependencies]);
  const predecessorMapRef = useRef(predecessorMap);
  predecessorMapRef.current = predecessorMap;

  const reflowMilestones = useMemo((): ReflowMilestone[] => {
    return features.map((f) => ({
      id: f.id,
      startDate: toLocalMidnight(f.startDate),
      endDate: toLocalMidnight(f.endDate),
      duration: f.duration,
    }));
  }, [features]);
  const reflowMilestonesRef = useRef(reflowMilestones);
  reflowMilestonesRef.current = reflowMilestones;

  const reflowDeps = useMemo((): ReflowDependency[] => {
    return dependencies.map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
    }));
  }, [dependencies]);
  const reflowDepsRef = useRef(reflowDeps);
  reflowDepsRef.current = reflowDeps;

  // Cell width
  const cellWidth = useMemo(() => {
    const { min, max } = ZOOM_CONFIG[timePeriod];
    return Math.round(min + (max - min) * ((zoomLevel - 1) / 8));
  }, [zoomLevel, timePeriod]);

  const pixelsPerDay = useMemo(() => getPixelsPerDay(cellWidth, timePeriod), [cellWidth, timePeriod]);
  const pixelsPerDayRef = useRef(pixelsPerDay);
  pixelsPerDayRef.current = pixelsPerDay;
  const timelineStartRef = useRef(windowStart);
  timelineStartRef.current = windowStart;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Scroll to date helper
  const scrollToDate = useCallback((targetDate: Date) => {
    const ppd = pixelsPerDayRef.current;
    const targetX = dateToPixel(targetDate, windowStartRef.current, ppd);
    const scrollEl = chartRef.current?.scrollRef;
    if (!scrollEl) return;
    const viewportWidth = scrollEl.clientWidth;
    const scrollTarget = Math.max(0, targetX - viewportWidth / 2);
    scrollEl.scrollLeft = scrollTarget;
  }, []);

  const scrollToToday = useCallback(() => {
    scrollToDate(startOfDay(new Date()));
  }, [scrollToDate]);

  useEffect(() => {
    const timeout = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timeout);
  }, [scrollToToday]);

  // --- Drag-to-connect & link delete ---
  useDragLink(ganttContainerRef, onCreateDependencyRef, ADD_FEATURE_TASK_ID);
  useLinkDelete(ganttContainerRef, onDeleteDependencyRef);

  // --- Bar drag ---
  const handleBarDragEnd = useCallback((
    taskId: string,
    startDate: Date,
    endDate: Date,
    duration: number,
    isTeamTrack: boolean,
    teamTrack: { milestoneId: string; teamId: string } | null
  ) => {
    if (isTeamTrack && teamTrack && onUpdateTeamDurationRef.current) {
      onUpdateTeamDurationRef.current(teamTrack.milestoneId, teamTrack.teamId, duration);
    } else {
      onUpdateDatesRef.current(taskId, startDate, endDate, duration);
    }
  }, []);

  const handleBarTaskClick = useCallback((taskId: string) => {
    if (taskId === ADD_FEATURE_TASK_ID) {
      onAddFeatureRef.current();
      return;
    }
    const teamTrack = parseTeamTrackId(taskId);
    const milestoneId = teamTrack ? teamTrack.milestoneId : taskId;
    const feature = featureMapRef.current.get(milestoneId);
    if (feature) onEditRef.current(feature);
  }, []);

  useBarDrag({
    containerRef: ganttContainerRef,
    pixelsPerDayRef,
    timelineStartRef,
    featureMapRef,
    predecessorMapRef,
    reflowMilestonesRef,
    reflowDepsRef,
    tasksRef,
    onDragEnd: handleBarDragEnd,
    onTaskClick: handleBarTaskClick,
    sentinelId: ADD_FEATURE_TASK_ID,
  });

  // --- Scroll sync between grid and chart ---
  // Grid uses overflow:hidden + translateY to follow chart's vertical scroll
  const handleChartScrollSync = useCallback((scrollLeft: number, scrollTop: number) => {
    const gridEl = gridScrollRef.current;
    if (gridEl) {
      const inner = gridEl.firstChild as HTMLElement;
      if (inner) inner.style.transform = `translateY(-${scrollTop}px)`;
    }
    handleChartScroll(scrollLeft, scrollTop);
  }, [handleChartScroll]);

  // --- Resize handle ---
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return;
    let startX = 0;
    let startWidth = 0;
    const onPointerMove = (e: PointerEvent) => {
      const newWidth = Math.max(120, Math.min(500, startWidth + (e.clientX - startX)));
      setGridColumnWidth(newWidth);
    };
    const onPointerUp = (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startWidth = storeGridColumnWidthRef.current;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };
    handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setGridColumnWidth]);

  // --- Grid row click ---
  const handleGridRowClick = useCallback((task: TimelineTask) => {
    handleBarTaskClick(task.id);
  }, [handleBarTaskClick]);

  // --- Row hover highlight ---
  const mainContentRef = useRef<HTMLDivElement>(null);
  const taskCountRef = useRef(tasks.length);
  taskCountRef.current = tasks.length;
  useEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;

    const highlight = document.createElement('div');
    highlight.className = 'timeline-row-hover';
    highlight.style.cssText =
      'position:absolute;left:0;right:0;pointer-events:none;opacity:0;transition:opacity 0.1s;z-index:1;';
    highlight.style.height = `${ROW_HEIGHT}px`;
    container.appendChild(highlight);

    const headerOffset = SCALE_HEIGHT * 2;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y <= headerOffset || y >= rect.height) {
        highlight.style.opacity = '0';
        return;
      }
      const rowIndex = Math.floor((y - headerOffset) / ROW_HEIGHT);
      if (rowIndex >= taskCountRef.current) {
        highlight.style.opacity = '0';
        return;
      }
      const rowTop = headerOffset + rowIndex * ROW_HEIGHT;
      highlight.style.top = `${rowTop}px`;
      highlight.style.opacity = '1';
    };

    const handleMouseLeave = () => {
      highlight.style.opacity = '0';
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      highlight.remove();
    };
  }, []);

  // --- Zoom ---
  const handleZoomIn = useCallback(() => {
    captureViewportCenterAnchor();
    setZoomLevel((p) => Math.min(9, p + 1));
  }, [captureViewportCenterAnchor]);
  const handleZoomOut = useCallback(() => {
    captureViewportCenterAnchor();
    setZoomLevel((p) => Math.max(1, p - 1));
  }, [captureViewportCenterAnchor]);

  // Ctrl+wheel zoom
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;
    let accumulatedDelta = 0;
    let pendingRaf: number | null = null;

    const flushZoom = () => {
      pendingRaf = null;
      if (accumulatedDelta < 0) {
        setZoomLevel((p) => Math.min(9, p + 1));
      } else if (accumulatedDelta > 0) {
        setZoomLevel((p) => Math.max(1, p - 1));
      }
      accumulatedDelta = 0;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (!zoomAnchorRef.current) {
        const scrollEl = chartRef.current?.scrollRef;
        if (scrollEl) {
          const rect = scrollEl.getBoundingClientRect();
          const viewportX = e.clientX - rect.left;
          if (viewportX >= 0 && viewportX <= rect.width) {
            const absoluteX = viewportX + scrollEl.scrollLeft;
            const ppd = pixelsPerDayRef.current;
            if (ppd > 0) {
              zoomAnchorRef.current = { dayOffset: absoluteX / ppd, viewportX };
            }
          }
        }
      }
      if (zoomAnchorClearRef.current) clearTimeout(zoomAnchorClearRef.current);
      zoomAnchorClearRef.current = setTimeout(() => {
        zoomAnchorRef.current = null;
        zoomAnchorClearRef.current = null;
      }, 200);
      accumulatedDelta += e.deltaY;
      if (pendingRaf === null) {
        pendingRaf = requestAnimationFrame(flushZoom);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      if (zoomAnchorClearRef.current) clearTimeout(zoomAnchorClearRef.current);
    };
  }, []);

  // Middle-click pan
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
      container.style.cursor = 'grabbing';
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const scrollEl = chartRef.current?.scrollRef;
      if (scrollEl) {
        scrollEl.scrollLeft -= dx;
        scrollEl.scrollTop -= dy;
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 1 || !isPanning) return;
      isPanning = false;
      container.style.cursor = '';
    };
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('auxclick', handleAuxClick);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('auxclick', handleAuxClick);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Zoom anchor scroll adjustment
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    const newPixelX = Math.round(anchor.dayOffset * pixelsPerDay);
    const scrollTarget = Math.max(0, newPixelX - anchor.viewportX);
    const scrollEl = chartRef.current?.scrollRef;
    if (scrollEl) scrollEl.scrollLeft = scrollTarget;
  }, [pixelsPerDay]);

  // Get scroll ref for markers
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Poll until chart mounts
    const check = () => {
      const el = chartRef.current?.scrollRef;
      if (el) {
        chartScrollRef.current = el;
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden isolate">
      {/* Toolbar */}
      <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
        {allProjects && allProjects.length > 1 && onProjectChange ? (
          <Select value={project.id} onValueChange={onProjectChange}>
            <SelectTrigger className="w-auto gap-1.5 text-sm font-medium border-none shadow-none bg-transparent" style={{ height: '28px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-medium">{project.name}</span>
        )}

        <div className="h-4 w-px bg-border mx-2" />

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" style={{ height: '28px' }} onClick={scrollToToday}>
            Today
          </Button>

          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[100px] text-xs" style={{ height: '28px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-4 w-px bg-border" />

          <Button
            variant={showDependencies ? 'secondary' : 'outline'}
            size="sm"
            className="text-xs"
            style={{ height: '28px' }}
            onClick={() => setShowDependencies(!showDependencies)}
          >
            <GitBranch className="h-3.5 w-3.5 mr-1.5" />
            Dependencies
          </Button>

          {teams.length > 0 && hasTeamTracks && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                {teams.map((team) => {
                  const isVisible = visibleTeamIds.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      onClick={() => toggleTeamVisibility(team.id)}
                      className={`flex items-center gap-1.5 px-2 rounded-full text-[11px] font-medium transition-all ${
                        isVisible
                          ? 'bg-secondary ring-1 ring-border'
                          : 'opacity-40 hover:opacity-70'
                      }`}
                      style={{ height: '24px' }}
                      title={`${isVisible ? 'Hide' : 'Show'} ${team.name}`}
                    >
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {allProjects && allProjects.length > 1 && onProjectChange && (
          <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
            <button
              className="flex items-center justify-center h-6 w-6 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => {
                const idx = allProjects.findIndex((p) => p.id === project.id);
                if (idx > 0) onProjectChange(allProjects[idx - 1].id);
              }}
              disabled={allProjects.findIndex((p) => p.id === project.id) <= 0}
              title="Previous milestone"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-px bg-border" />
            <button
              className="flex items-center justify-center h-6 w-6 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => {
                const idx = allProjects.findIndex((p) => p.id === project.id);
                if (idx < allProjects.length - 1) onProjectChange(allProjects[idx + 1].id);
              }}
              disabled={allProjects.findIndex((p) => p.id === project.id) >= allProjects.length - 1}
              title="Next milestone"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div ref={mainContentRef} className="flex flex-1 min-h-0 relative">
        <TimelineGrid
          tasks={tasks}
          width={storeGridColumnWidth}
          featureCount={sortedFeatures.length}
          scrollRef={gridScrollRef}
          onRowClick={handleGridRowClick}
          onStatusChange={onStatusChangeRef}
          onAddFeature={onAddFeature}
        />

        <div
          ref={resizeHandleRef}
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors"
        />

        <div
          ref={ganttContainerRef}
          className="flex-1 min-w-0 svar-timeline-container relative overflow-hidden"
          style={{
            '--timeline-cell-width': `${cellWidth}px`,
            '--timeline-row-height': `${ROW_HEIGHT}px`,
          } as React.CSSProperties}
        >
          <TimelineChart
            ref={chartRef}
            tasks={tasks}
            links={links}
            windowStart={windowStart}
            windowEnd={windowEnd}
            cellWidth={cellWidth}
            timePeriod={timePeriod}
            pixelsPerDay={pixelsPerDay}
            onScroll={handleChartScrollSync}
            onTaskClick={handleBarTaskClick}
          />

          <TodayMarker
            scrollRef={chartScrollRef}
            pixelsPerDay={pixelsPerDay}
            timelineStart={windowStart}
            scaleHeight={SCALE_HEIGHT}
          />

          <CursorMarker
            scrollRef={chartScrollRef}
            pixelsPerDay={pixelsPerDay}
            timelineStart={windowStart}
            scaleHeight={SCALE_HEIGHT}
          />

          {/* Zoom controls */}
          <div
            className="absolute flex flex-col rounded-md border border-border bg-background/95 backdrop-blur-sm shadow-sm overflow-hidden z-10"
            style={{
              top: `${SCALE_HEIGHT * 2 + 8}px`,
              right: '12px',
            }}
          >
            <button
              className="flex items-center justify-center w-6 h-6 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 9}
              title="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="h-px bg-border" />
            <button
              className="flex items-center justify-center w-6 h-6 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              title="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy alias
export { TimelineView as SVARTimelineView };
