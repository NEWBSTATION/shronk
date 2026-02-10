'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { startOfDay, addDays, addMonths, subMonths, differenceInDays } from 'date-fns';
import { Gantt } from '@svar-ui/react-gantt';
import type { IApi } from '@svar-ui/react-gantt';
import { Plus, Minus, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SVARThemeWrapper } from './svar-theme-wrapper';
import { TodayMarker } from './today-marker';
import { CursorMarker } from './cursor-marker';
import { milestoneToSVARTask, dependencyToSVARLink, svarEndDateToInclusive, toLocalMidnight } from './transformers';
import { getScaleConfig, ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from './constants';
import { useTimelineStore } from '@/store/timeline-store';
import { reflowProject, type ReflowMilestone, type ReflowDependency } from '@/lib/reflow';
import type { CascadedUpdate } from '@/hooks/use-milestones';
import type { TimePeriod, SVARTask, SVARLink } from './types';
import type { Milestone, MilestoneDependency, MilestoneStatus, MilestonePriority, Team, Project } from '@/db/schema';
import { TaskBarTemplate } from './task-bar-template';
import { useDragLink } from './use-drag-link';
import { useLinkDelete } from './use-link-delete';

const ADD_FEATURE_TASK_ID = '__add_feature__';

// Timeline windowing — initial padding (months each side) and expansion chunk (months)
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

// Zoom level configuration
const ZOOM_CONFIG: Record<TimePeriod, { min: number; max: number }> = {
  week: { min: 30, max: 120 },
  month: { min: 60, max: 180 },
  quarter: { min: 60, max: 220 },
  year: { min: 60, max: 220 },
};

interface SVARTimelineViewProps {
  project: Project;
  allProjects?: Project[];
  onProjectChange?: (id: string) => void;
  features: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  onBack: () => void;
  onEdit: (feature: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (id: string, startDate: Date, endDate: Date, duration?: number) => Promise<CascadedUpdate[]>;
  onStatusChange: (id: string, status: MilestoneStatus) => Promise<void>;
  onPriorityChange?: (id: string, priority: MilestonePriority) => Promise<void>;
  onAddFeature: () => void;
  onCreateDependency: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency: (id: string) => Promise<void>;
}

export function SVARTimelineView({
  project,
  allProjects,
  onProjectChange,
  features,
  dependencies,
  teams,
  onBack,
  onEdit,
  onUpdateDates,
  onAddFeature,
  onCreateDependency,
  onDeleteDependency,
}: SVARTimelineViewProps) {

  // Per-milestone time period from store (persisted to localStorage)
  const timePeriod = useTimelineStore((s) => s.getMilestoneTimePeriod(project.id)) as TimePeriod;
  const setMilestoneTimePeriod = useTimelineStore((s) => s.setMilestoneTimePeriod);
  const setTimePeriod = useCallback(
    (period: TimePeriod) => setMilestoneTimePeriod(project.id, period),
    [project.id, setMilestoneTimePeriod]
  );

  // State
  const [zoomLevel, setZoomLevel] = useState(5);
  const [showDependencies, setShowDependencies] = useState(true);

  // Refs
  const ganttApiRef = useRef<IApi | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // Keep a ref to dependencies so event handlers always see the latest value
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

  // Drag-to-connect dependency creation
  useDragLink(ganttContainerRef, onCreateDependencyRef, ADD_FEATURE_TASK_ID);

  // Click-on-link delete button
  useLinkDelete(ganttContainerRef, onDeleteDependencyRef);

  // --- Timeline windowing (lazy-load columns) ---
  const [windowStart, setWindowStart] = useState<Date>(() => computeInitialWindow(features, timePeriod).start);
  const [windowEnd, setWindowEnd] = useState<Date>(() => computeInitialWindow(features, timePeriod).end);

  // Refs so scroll handler always sees latest values without re-registering
  const windowStartRef = useRef(windowStart);
  windowStartRef.current = windowStart;
  const windowEndRef = useRef(windowEnd);
  windowEndRef.current = windowEnd;
  const timePeriodRef = useRef(timePeriod);
  timePeriodRef.current = timePeriod;
  const cellWidthRef = useRef(0); // updated below after cellWidth is computed

  // Expansion lock + scroll preservation for left expansion
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod]);

  // Auto-expand window if any feature falls outside (e.g. newly created)
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

  // Helper to find the SVAR chart scroll element
  const getScrollElement = useCallback(() => {
    const container = ganttContainerRef.current;
    if (!container) return null;
    const wxArea = container.querySelector('.wx-area') as HTMLElement;
    return wxArea?.parentElement || null;
  }, []);

  // Attach scroll listener for edge-based expansion (once after SVAR mounts)
  useEffect(() => {
    let mounted = true;
    let scrollEl: HTMLElement | null = null;

    const handleScroll = () => {
      if (isExpandingRef.current || !scrollEl) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
      const threshold = clientWidth; // 1 viewport width from edge

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
    };

    // Retry until SVAR's scroll container is in the DOM
    const tryAttach = () => {
      scrollEl = getScrollElement();
      if (!scrollEl) {
        if (mounted) requestAnimationFrame(tryAttach);
        return;
      }
      scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    };
    requestAnimationFrame(tryAttach);

    return () => {
      mounted = false;
      scrollEl?.removeEventListener('scroll', handleScroll);
    };
  }, [getScrollElement]);

  // After window change, preserve scroll position (left expansion shifts content right)
  const prevWindowRef = useRef({ start: windowStart, end: windowEnd });
  useEffect(() => {
    const prev = prevWindowRef.current;
    prevWindowRef.current = { start: windowStart, end: windowEnd };

    const adj = scrollAdjustRef.current;
    if (adj && windowStart < prev.start) {
      scrollAdjustRef.current = null;
      // Double-rAF: wait for SVAR to render new cells
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const api = ganttApiRef.current;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const state = api?.getState() as any;
          const scales = state?._scales;
          if (scales?.diff && scales.lengthUnit) {
            const addedPixels = Math.round(
              scales.diff(adj.oldStart, windowStart, scales.lengthUnit) * cellWidthRef.current,
            );
            const scrollEl = getScrollElement();
            if (scrollEl && addedPixels > 0) {
              scrollEl.scrollLeft = adj.oldScrollLeft + addedPixels;
              api?.exec('scroll-chart', { left: adj.oldScrollLeft + addedPixels });
            }
          }
          isExpandingRef.current = false;
        });
      });
    } else {
      isExpandingRef.current = false;
    }
  }, [windowStart, windowEnd, getScrollElement]);

  // Zoom anchoring: track cursor position so zooming keeps the date under cursor in place
  const cursorInfoRef = useRef<{ absoluteX: number; viewportX: number } | null>(null);
  const zoomAnchorRef = useRef<{ fractionalUnits: number; viewportX: number } | null>(null);
  const zoomAnchorClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCursorMove = useCallback((info: { absoluteX: number; viewportX: number } | null) => {
    cursorInfoRef.current = info;
  }, []);

  // Sort and transform features
  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [features]);

  const tasks: SVARTask[] = useMemo(() => {
    const featureTasks = sortedFeatures.map(milestoneToSVARTask);
    // Sentinel row: "+ Add feature" (like ClickUp)
    featureTasks.push({
      id: ADD_FEATURE_TASK_ID,
      text: '',
      start: TIMELINE_START_DATE,
      end: TIMELINE_START_DATE, // 0-width → no visible bar
      duration: 0,
      durationText: '',
      progress: 0,
      type: 'task',
    });
    return featureTasks;
  }, [sortedFeatures]);

  const links: SVARLink[] = useMemo(() => {
    if (!showDependencies) return [];
    const featureIds = new Set(sortedFeatures.map((f) => f.id));
    return dependencies
      .filter((d) => featureIds.has(d.predecessorId) && featureIds.has(d.successorId))
      .map(dependencyToSVARLink);
  }, [showDependencies, dependencies, sortedFeatures]);

  // Feature lookup map
  const featureMap = useMemo(() => {
    const map = new Map<string, Milestone>();
    features.forEach((f) => map.set(f.id, f));
    return map;
  }, [features]);
  const featureMapRef = useRef(featureMap);
  featureMapRef.current = featureMap;

  // Successor adjacency list (predecessorId → successorId[])
  const successorMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const dep of dependencies) {
      const list = map.get(dep.predecessorId) || [];
      list.push(dep.successorId);
      map.set(dep.predecessorId, list);
    }
    return map;
  }, [dependencies]);
  const successorMapRef = useRef(successorMap);
  successorMapRef.current = successorMap;

  // Predecessor adjacency list (successorId → predecessorId[])
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

  // Reflow data for tight cascade preview
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

  // Drag-cascade state (refs — no re-renders needed)
  const isDraggingRef = useRef(false);
  const draggedTaskIdRef = useRef<string | null>(null);
  // Tracks original SVAR-format dates for cascaded tasks so we can revert on cancel
  const cascadeOriginalsRef = useRef<Map<string, { start: Date; end: Date }>>(new Map());
  // Timeout to detect drag cancel vs successful drop
  const dropRevertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // De-duplicate: skip api.exec calls when cascade result hasn't changed
  const lastCascadeKeyRef = useRef('');

  // Cell width must be computed before scales (scales format depends on cellWidth)
  const cellWidth = useMemo(() => {
    const { min, max } = ZOOM_CONFIG[timePeriod];
    return Math.round(min + (max - min) * ((zoomLevel - 1) / 8));
  }, [zoomLevel, timePeriod]);
  cellWidthRef.current = cellWidth;

  // Scale config — adapts labels when cells are too narrow (e.g. drops day letter in week view)
  const scales = useMemo(() => getScaleConfig(timePeriod, cellWidth), [timePeriod, cellWidth]);

  // Weekend highlighting — returns "wx-weekend" for Sat/Sun so SVAR renders overlay elements
  const highlightTime = useCallback((date: Date, unit: 'day' | 'hour') => {
    if (unit === 'day') {
      const day = date.getDay();
      if (day === 0 || day === 6) return 'wx-weekend';
    }
    return '';
  }, []);

  // Initialize Gantt API
  const initGantt = useCallback((api: IApi) => {
    ganttApiRef.current = api;

    // --- Helper: revert all cascaded tasks to original positions ---
    const revertCascadedTasks = () => {
      for (const [taskId, orig] of cascadeOriginalsRef.current) {
        api.exec('update-task', {
          id: taskId,
          task: { start: orig.start, end: orig.end },
          inProgress: true,
        });
      }
      cascadeOriginalsRef.current.clear();
      lastCascadeKeyRef.current = '';
    };

    // --- Live cascade during drag via SVAR's update-task API ---
    api.on('drag-task', (ev) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { id, left, width, inProgress } = ev as any;

      if (!inProgress || left == null || width == null) {
        // Drag ended — schedule revert in case of cancel.
        isDraggingRef.current = false;
        draggedTaskIdRef.current = null;

        if (cascadeOriginalsRef.current.size > 0) {
          dropRevertTimeoutRef.current = setTimeout(() => {
            revertCascadedTasks();
            dropRevertTimeoutRef.current = null;
          }, 150);
        }
        return;
      }

      const taskId = String(id);
      isDraggingRef.current = true;
      draggedTaskIdRef.current = taskId;

      // Skip sentinel row
      if (taskId === ADD_FEATURE_TASK_ID) return;

      // Get the original task data from our feature map
      const original = featureMapRef.current.get(taskId);
      if (!original) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = api.getState() as any;
      const scalesInternal = state?._scales;
      const cw = state?.cellWidth;
      if (!scalesInternal?.diff || !cw) return;

      const origStart = toLocalMidnight(original.startDate);
      const origEnd = toLocalMidnight(original.endDate);

      // Compute pixels-per-day using SVAR's scale math
      const oneDayLater = addDays(origStart, 1);
      const pixelsPerDay = scalesInternal.diff(oneDayLater, origStart, scalesInternal.lengthUnit) * cw;
      if (pixelsPerDay <= 0) return;

      // Detect drag type from pixel deltas
      const origExclEnd = addDays(origEnd, 1); // inclusive → exclusive
      const origPixelStart = Math.round(scalesInternal.diff(origStart, scalesInternal.start, scalesInternal.lengthUnit) * cw);
      const origPixelEnd = Math.round(scalesInternal.diff(origExclEnd, scalesInternal.start, scalesInternal.lengthUnit) * cw);

      const newPixelStart = left;
      const newPixelEnd = left + width;

      const startDaysDelta = Math.round((newPixelStart - origPixelStart) / pixelsPerDay);
      const endDaysDelta = Math.round((newPixelEnd - origPixelEnd) / pixelsPerDay);

      const isChained = (predecessorMapRef.current.get(taskId) || []).length > 0;

      // Determine override for reflow
      let override: Partial<ReflowMilestone> | null = null;

      if (startDaysDelta === 0 && endDaysDelta !== 0) {
        // Resize-end: changes duration
        const newDuration = Math.max(1, original.duration + endDaysDelta);
        override = { duration: newDuration };
      } else if (Math.abs(startDaysDelta - endDaysDelta) <= 1 && startDaysDelta !== 0) {
        // Move (both edges shift roughly equally)
        if (isChained) {
          // Chained features can't be moved — reflow will snap them back
          // Don't apply any override — cascade with current data
          if (cascadeOriginalsRef.current.size > 0) {
            revertCascadedTasks();
          }
          return;
        } else {
          // Root move: shift start date
          const newStart = addDays(origStart, startDaysDelta);
          override = { startDate: newStart };
        }
      } else if (startDaysDelta !== 0 && endDaysDelta === 0) {
        // Resize-start (left edge moved)
        if (isChained) {
          // Chained: can't resize start
          if (cascadeOriginalsRef.current.size > 0) {
            revertCascadedTasks();
          }
          return;
        } else {
          // Root: changes start + duration
          const newStart = addDays(origStart, startDaysDelta);
          const newDuration = Math.max(1, original.duration - startDaysDelta);
          override = { startDate: newStart, duration: newDuration };
        }
      } else {
        // No meaningful change
        return;
      }

      // Run tight reflow with override
      const overrides = override
        ? new Map([[taskId, override]])
        : undefined;

      const cascade = reflowProject(
        reflowMilestonesRef.current,
        reflowDepsRef.current,
        overrides
      );

      // Skip if cascade result hasn't changed
      const cascadeKey = cascade.map((u) => `${u.id}:${u.startDate.getTime()}:${u.endDate.getTime()}`).join(',');
      if (cascadeKey === lastCascadeKeyRef.current) return;
      lastCascadeKeyRef.current = cascadeKey;

      const newCascadedIds = new Set(cascade.map((u) => u.id));

      // Revert tasks that no longer need cascading
      for (const [prevId, orig] of cascadeOriginalsRef.current) {
        if (!newCascadedIds.has(prevId)) {
          api.exec('update-task', { id: prevId, task: { start: orig.start, end: orig.end }, inProgress: true });
          cascadeOriginalsRef.current.delete(prevId);
        }
      }

      // Apply cascade via SVAR's update-task
      for (const update of cascade) {
        // Skip the dragged task itself — SVAR handles its visual position
        if (update.id === taskId) continue;

        const dep = featureMapRef.current.get(update.id);
        if (!dep) continue;

        // Save original SVAR-format dates if not already saved
        if (!cascadeOriginalsRef.current.has(update.id)) {
          const origDepStart = toLocalMidnight(dep.startDate);
          const origDepEnd = addDays(toLocalMidnight(dep.endDate), 1);
          cascadeOriginalsRef.current.set(update.id, { start: origDepStart, end: origDepEnd });
        }

        // Convert to SVAR exclusive end
        const svarEnd = addDays(update.endDate, 1);
        api.exec('update-task', { id: update.id, task: { start: update.startDate, end: svarEnd }, inProgress: true });
      }
    });

    // --- Drop: persist to server ---
    api.on('update-task', (ev) => {
      // Cancel revert timeout — drop was successful
      if (dropRevertTimeoutRef.current) {
        clearTimeout(dropRevertTimeoutRef.current);
        dropRevertTimeoutRef.current = null;
      }

      // Skip in-progress cascade preview updates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ev as any).inProgress) return;
      if (isDraggingRef.current) return;

      const taskId = String((ev as Record<string, unknown>).id ?? ev.task?.id);
      if (taskId === ADD_FEATURE_TASK_ID) return;
      const task = ev.task;
      if (!taskId || !task?.start || !task?.end) return;

      // Clear cascade state
      cascadeOriginalsRef.current.clear();
      lastCascadeKeyRef.current = '';
      isDraggingRef.current = false;
      draggedTaskIdRef.current = null;

      const svarStart = task.start as Date;
      const inclusiveEnd = svarEndDateToInclusive(task.end as Date);

      // Derive duration from the final SVAR dates
      const duration = differenceInDays(inclusiveEnd, svarStart) + 1;
      onUpdateDatesRef.current(taskId, svarStart, inclusiveEnd, duration);
    });

    api.on('add-link', (ev) => {
      const link = ev.link;
      if (link?.source && link.target) {
        if (link.source === ADD_FEATURE_TASK_ID || link.target === ADD_FEATURE_TASK_ID) return;
        onCreateDependencyRef.current(link.source as string, link.target as string);
      }
    });

    api.on('delete-link', (ev) => {
      // SVAR sends { id } where id is the link ID (= our dependency ID)
      const linkId = String((ev as Record<string, unknown>).id ?? '');
      if (linkId) {
        onDeleteDependencyRef.current(linkId);
      }
    });

    // Intercept select on sentinel to trigger add feature
    api.intercept('select-task', (ev) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ev as any).id === ADD_FEATURE_TASK_ID) {
        // Defer to next microtask to avoid SVAR re-entrant state loop
        Promise.resolve().then(() => onAddFeatureRef.current());
        return false;
      }
      return true;
    });

    // Open sheet on single-click (select)
    api.on('select-task', (ev) => {
      if (ev.id) {
        const feature = featureMapRef.current.get(ev.id as string);
        if (feature) onEditRef.current(feature);
      }
    });

    // Prevent SVAR's built-in editor on double-click
    api.intercept('show-editor', () => false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to today using SVAR's internal scales for accurate pixel calculation
  const scrollToToday = useCallback(() => {
    const api = ganttApiRef.current;
    const container = ganttContainerRef.current;
    if (!api || !container) return;

    const today = startOfDay(new Date());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = api.getState() as any;
    const scalesInternal = state?._scales;
    if (!scalesInternal?.diff || !scalesInternal.start || !scalesInternal.lengthUnit) return;

    const todayX = Math.round(scalesInternal.diff(today, scalesInternal.start, scalesInternal.lengthUnit) * state.cellWidth);
    if (todayX < 0) return;

    const wxArea = container.querySelector('.wx-area') as HTMLElement;
    const scrollContainer = wxArea?.parentElement;
    if (!scrollContainer) return;

    const viewportWidth = scrollContainer.clientWidth;
    const scrollTarget = Math.max(0, todayX - viewportWidth / 2);

    api.exec('scroll-chart', { left: scrollTarget });
    scrollContainer.scrollLeft = scrollTarget;
  }, []);

  useEffect(() => {
    const timeout = setTimeout(scrollToToday, 300);
    return () => clearTimeout(timeout);
  }, [scrollToToday]);

  // Cleanup cascade revert timeout on unmount
  useEffect(() => {
    return () => {
      if (dropRevertTimeoutRef.current) {
        clearTimeout(dropRevertTimeoutRef.current);
      }
    };
  }, []);

  // Row hover highlight — spans both left grid and right chart
  const rowHoverRef = useRef<HTMLDivElement | null>(null);
  const taskCountRef = useRef(tasks.length);
  taskCountRef.current = tasks.length;
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;

    // Create the highlight element
    const highlight = document.createElement('div');
    highlight.className = 'timeline-row-hover';
    highlight.style.cssText =
      'position:absolute;left:0;right:0;pointer-events:none;opacity:0;transition:opacity 0.1s;z-index:0;';
    highlight.style.height = `${ROW_HEIGHT}px`;
    container.appendChild(highlight);
    rowHoverRef.current = highlight;

    const headerOffset = SCALE_HEIGHT * 2;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;

      // Only highlight rows below the timescale header
      if (y <= headerOffset || y >= rect.height) {
        highlight.style.opacity = '0';
        return;
      }

      const rowIndex = Math.floor((y - headerOffset) / ROW_HEIGHT);

      // Only highlight rows that have actual tasks (features + add feature row)
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

  // Zoom handlers
  const handleZoomIn = useCallback(() => setZoomLevel((p) => Math.min(9, p + 1)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((p) => Math.max(1, p - 1)), []);

  // Ctrl+wheel / trackpad pinch to zoom (with cursor anchoring)
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      // Only capture anchor if no pending one exists — during rapid zoom,
      // the first capture is always consistent (cellWidth + scrollLeft match).
      // Subsequent events before render see stale values and would corrupt it.
      if (!zoomAnchorRef.current) {
        const api = ganttApiRef.current;
        if (api) {
          const wxArea = container.querySelector('.wx-area') as HTMLElement;
          const scrollContainer = wxArea?.parentElement;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const state = api.getState() as any;
          if (scrollContainer && state?.cellWidth) {
            const rect = scrollContainer.getBoundingClientRect();
            const viewportX = e.clientX - rect.left;
            if (viewportX >= 0 && viewportX <= rect.width) {
              const absoluteX = viewportX + scrollContainer.scrollLeft;
              const fractionalUnits = absoluteX / state.cellWidth;
              zoomAnchorRef.current = { fractionalUnits, viewportX };
            }
          }
        }
      }

      // Keep anchor alive while zooming — clear only after activity settles
      if (zoomAnchorClearRef.current) clearTimeout(zoomAnchorClearRef.current);
      zoomAnchorClearRef.current = setTimeout(() => {
        zoomAnchorRef.current = null;
        zoomAnchorClearRef.current = null;
      }, 200);

      if (e.deltaY < 0) {
        setZoomLevel((p) => Math.min(9, p + 1));
      } else if (e.deltaY > 0) {
        setZoomLevel((p) => Math.max(1, p - 1));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (zoomAnchorClearRef.current) clearTimeout(zoomAnchorClearRef.current);
    };
  }, []);

  // Middle-click grab-to-pan (replaces browser auto-scroll)
  useEffect(() => {
    const container = ganttContainerRef.current;
    if (!container) return;

    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    // Block the default auto-scroll on middle-click
    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // middle button only
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

      const scrollEl = getScrollElement();
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
  }, [getScrollElement]);

  // After cellWidth changes, scroll to keep the anchored point at the same viewport position.
  // The anchor persists across rapid zoom (cleared by timeout in wheel handler, not here).
  // Query the scroll element fresh each call (SVAR may recreate DOM nodes during re-render).
  useEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;

    const container = ganttContainerRef.current;
    const api = ganttApiRef.current;
    if (!container || !api) return;

    const newPixelX = Math.round(anchor.fractionalUnits * cellWidth);
    const scrollTarget = Math.max(0, newPixelX - anchor.viewportX);

    const applyScroll = () => {
      const wxArea = container.querySelector('.wx-area') as HTMLElement;
      const sc = wxArea?.parentElement;
      if (!sc) return;
      sc.scrollLeft = scrollTarget;
      api.exec('scroll-chart', { left: scrollTarget });
    };

    applyScroll();
    const raf1 = requestAnimationFrame(() => {
      applyScroll();
      requestAnimationFrame(applyScroll);
    });

    return () => cancelAnimationFrame(raf1);
  }, [cellWidth]);

  // Memoize columns to prevent SVAR Grid re-initialization on every render
  const columns = useMemo(() => [
    {
      id: 'text',
      header: 'Feature',
      width: 200,
      resize: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell: ({ row }: any) => {
        if (row.id === ADD_FEATURE_TASK_ID) {
          return (
            <div className="flex items-center gap-1.5 w-full text-muted-foreground cursor-pointer">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">Add feature</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 w-full min-w-0">
            <span className="truncate min-w-0 flex-1">{row.text}</span>
            <span className="shrink-0 ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {row.durationText}
            </span>
          </div>
        );
      },
    },
  ], []);

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="relative flex items-center px-3 py-2 border-b border-border bg-muted/30">
        {/* Left controls */}
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

          {/* Separator */}
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
        </div>

        {/* Center — milestone selector */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {allProjects && allProjects.length > 1 && onProjectChange ? (
            <Select value={project.id} onValueChange={onProjectChange}>
              <SelectTrigger className="w-auto gap-1.5 text-sm font-medium border-none shadow-none bg-transparent pointer-events-auto" style={{ height: '28px' }}>
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
        </div>

        {/* Right — feature count */}
        <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
          {sortedFeatures.length} feature{sortedFeatures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Main content - Let SVAR handle the grid and chart layout */}
      <div
        ref={ganttContainerRef}
        className="flex-1 min-h-0 svar-timeline-container relative"
        style={{
          '--timeline-cell-width': `${cellWidth}px`,
          '--timeline-row-height': `${ROW_HEIGHT}px`,
        } as React.CSSProperties}
      >
        <SVARThemeWrapper>
          <Gantt
            tasks={tasks}
            links={links}
            scales={scales}
            columns={columns}
            cellWidth={cellWidth}
            cellHeight={ROW_HEIGHT}
            scaleHeight={SCALE_HEIGHT}
            start={windowStart}
            end={windowEnd}
            cellBorders="column"
            highlightTime={highlightTime}
            taskTemplate={TaskBarTemplate}
            init={initGantt}
          />
        </SVARThemeWrapper>

        {/* Custom Today Marker (SVAR markers are paywalled) */}
        <TodayMarker
          ganttApiRef={ganttApiRef}
          scaleHeight={SCALE_HEIGHT}
        />

        {/* Cursor Marker - follows mouse with date label */}
        <CursorMarker
          ganttApiRef={ganttApiRef}
          scaleHeight={SCALE_HEIGHT}
          onCursorMove={handleCursorMove}
        />

        {/* Zoom controls overlay */}
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
  );
}
