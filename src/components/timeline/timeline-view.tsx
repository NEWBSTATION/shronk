'use client';

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { startOfDay, addDays, addMonths, subMonths, differenceInDays } from 'date-fns';
import { Plus, Minus, GitBranch, Users, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
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
import { topoSortFeatures } from '@/lib/topo-sort';
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
  onAddFeature: (opts?: { chain?: boolean }) => void;
  onQuickCreate?: (name: string, startDate: Date, endDate: Date, duration: number, chainToId?: string) => Promise<void>;
  onCreateDependency: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency: (id: string) => Promise<void>;
  onReorderFeatures?: (projectId: string, orderedFeatureIds: string[]) => Promise<void>;
  onMilestoneClick?: (project: Project) => void;
  onAddMilestone?: () => void;
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
  onQuickCreate,
  onStatusChange,
  onCreateDependency,
  onDeleteDependency,
  onReorderFeatures,
  onMilestoneClick,
  onAddMilestone,
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

  const zoomLevel = useTimelineStore((s) => s.milestoneZoomLevels[project.id] ?? 5);
  const setMilestoneZoomLevel = useTimelineStore((s) => s.setMilestoneZoomLevel);
  const setZoomLevel = useCallback(
    (levelOrUpdater: number | ((prev: number) => number)) => {
      const current = useTimelineStore.getState().milestoneZoomLevels[project.id] ?? 5;
      const next = typeof levelOrUpdater === 'function' ? levelOrUpdater(current) : levelOrUpdater;
      setMilestoneZoomLevel(project.id, next);
    },
    [project.id, setMilestoneZoomLevel]
  );
  const [showDependencies, setShowDependencies] = useState(true);
  const [isGridDragging, setIsGridDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute set of feature IDs that match the search query (null = no search active)
  const searchMatchIds = useMemo((): Set<string> | null => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(features.filter((f) => f.title.toLowerCase().includes(q)).map((f) => f.id));
  }, [searchQuery, features]);

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
  const onReorderFeaturesRef = useRef(onReorderFeatures);
  onReorderFeaturesRef.current = onReorderFeatures;

  const setGridColumnWidth = useTimelineStore((s) => s.setGridColumnWidth);
  const storeGridColumnWidth = useTimelineStore((s) => s.gridColumnWidth);
  const storeGridColumnWidthRef = useRef(storeGridColumnWidth);
  storeGridColumnWidthRef.current = storeGridColumnWidth;

  const gridScrollRef = useRef<HTMLDivElement>(null);

  const visibleTeamIds = useTimelineStore((s) => s.visibleTeamIds);
  const setVisibleTeamIds = useTimelineStore((s) => s.setVisibleTeamIds);
  const toggleTeamVisibility = useTimelineStore((s) => s.toggleTeamVisibility);

  const prevTeamIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    const currentTeamIds = teams.map((t) => t.id);
    const currentSet = new Set(currentTeamIds);
    const prevIds = prevTeamIdsRef.current;
    prevTeamIdsRef.current = currentTeamIds;

    // First load with no persisted selection — show all
    if (currentTeamIds.length > 0 && visibleTeamIds === null) {
      setVisibleTeamIds(currentTeamIds);
      return;
    }

    // Prune stale IDs that no longer exist
    const pruned = (visibleTeamIds ?? []).filter((id) => currentSet.has(id));

    // Only detect "new" teams after the initial mount (prevIds !== null)
    const newTeamIds = prevIds
      ? currentTeamIds.filter((id) => !prevIds.includes(id))
      : [];
    const updated = [...pruned, ...newTeamIds];

    if (updated.length !== (visibleTeamIds ?? []).length || newTeamIds.length > 0) {
      setVisibleTeamIds(updated);
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

  // Sort features by dependency chain order (topo sort) so arrows flow top-to-bottom
  const sortedFeatures = useMemo(() => {
    return topoSortFeatures(features, dependencies);
  }, [features, dependencies]);

  const hasTeamTracks = teamDurations.length > 0;

  // Chain info: last feature in the sorted list for chain-to behavior
  const chainInfo = useMemo(() => {
    if (sortedFeatures.length === 0) return null;
    const last = sortedFeatures[sortedFeatures.length - 1];
    return {
      featureId: last.id,
      featureTitle: last.title,
      endDate: toLocalMidnight(last.endDate),
    };
  }, [sortedFeatures]);

  // Chain-end IDs: features that have no successors (nothing depends on them)
  const chainEndIds = useMemo(() => {
    const predecessorSet = new Set(dependencies.map(d => d.predecessorId));
    return new Set(sortedFeatures.filter(f => !predecessorSet.has(f.id)).map(f => f.id));
  }, [sortedFeatures, dependencies]);

  const tasks: TimelineTask[] = useMemo(() => {
    let featureTasks: TimelineTask[];

    const resolvedTeamIds = visibleTeamIds ?? [];
    if (hasTeamTracks && resolvedTeamIds.length > 0) {
      featureTasks = milestonesToTimelineTasksWithTeamTracks(
        sortedFeatures,
        teamDurations,
        teams,
        resolvedTeamIds
      );
    } else {
      featureTasks = sortedFeatures.map(milestoneToTimelineTask);
    }

    // Mark chain-end parent nodes
    for (const task of featureTasks) {
      if (!task.$custom?.isTeamTrack && chainEndIds.has(task.id)) {
        if (task.$custom) task.$custom.isChainEnd = true;
      }
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
  }, [sortedFeatures, hasTeamTracks, teamDurations, teams, visibleTeamIds, chainEndIds]);

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

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onAddFeatureRef.current(e.shiftKey ? { chain: true } : undefined);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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

  // --- Grid row reorder ---
  const handleGridReorder = useCallback((orderedFeatureIds: string[]) => {
    onReorderFeaturesRef.current?.(project.id, orderedFeatureIds);
  }, [project.id]);

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

    const handleScroll = () => {
      highlight.style.opacity = '0';
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('scroll', handleScroll, true);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('scroll', handleScroll, true);
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDependencies ? 'secondary' : 'outline'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowDependencies(!showDependencies)}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dependencies</TooltipContent>
          </Tooltip>

          {teams.length > 0 && hasTeamTracks && (
            <>
              <div className="h-4 w-px bg-border" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Tracks
                    {(visibleTeamIds ?? []).length > 0 && (
                      <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {(visibleTeamIds ?? []).length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0" align="start">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">Team Tracks</span>
                    <button
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        if ((visibleTeamIds ?? []).length === teams.length) {
                          setVisibleTeamIds([]);
                        } else {
                          setVisibleTeamIds(teams.map((t) => t.id));
                        }
                      }}
                    >
                      {(visibleTeamIds ?? []).length === teams.length ? 'Hide all' : 'Show all'}
                    </button>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {teams.map((team) => {
                      const isVisible = (visibleTeamIds ?? []).includes(team.id);
                      return (
                        <div
                          key={team.id}
                          role="button"
                          onClick={() => toggleTeamVisibility(team.id)}
                          className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors cursor-pointer"
                        >
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="flex-1 text-left truncate">{team.name}</span>
                          <Switch
                            size="sm"
                            checked={isVisible}
                            tabIndex={-1}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleTeamVisibility(team.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-40 pl-8 pr-7 text-xs rounded-md"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div ref={mainContentRef} className="flex flex-1 min-h-0 relative">
        <TimelineGrid
          tasks={tasks}
          features={sortedFeatures}
          width={storeGridColumnWidth}
          scrollRef={gridScrollRef}
          onRowClick={handleGridRowClick}
          onStatusChange={onStatusChangeRef}
          onAddFeature={onAddFeature}
          onReorder={handleGridReorder}
          onDragActiveChange={setIsGridDragging}
          project={project}
          allProjects={allProjects}
          onProjectChange={onProjectChange}
          onMilestoneClick={onMilestoneClick}
          onAddMilestone={onAddMilestone}
          searchMatchIds={searchMatchIds}
        />

        <div
          ref={resizeHandleRef}
          className="shrink-0 cursor-col-resize flex items-stretch justify-center group"
          style={{ width: '9px', marginLeft: '-4px', marginRight: '-4px' }}
        >
          <div className="w-px bg-border group-hover:bg-primary/60 group-active:bg-primary/80 transition-colors" />
        </div>

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
            addFeatureRowIndex={onQuickCreate ? (isGridDragging ? tasks.filter(t => !t.$custom?.isTeamTrack).length - 1 : tasks.length - 1) : undefined}
            onQuickCreate={onQuickCreate}
            chainInfo={chainInfo}
            hideTeamTracks={isGridDragging}
            searchMatchIds={searchMatchIds}
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
