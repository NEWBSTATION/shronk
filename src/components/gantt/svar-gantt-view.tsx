'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { startOfDay, addDays, differenceInDays } from 'date-fns';
import { Gantt } from '@svar-ui/react-gantt';
import type { IApi } from '@svar-ui/react-gantt';
import { Plus, Minus, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHeader } from '@/components/header-context';
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
import { useGanttStore } from '@/store/gantt-store';
import type { CascadedUpdate } from '@/hooks/use-milestones';
import type { TimePeriod, SVARTask, SVARLink } from './types';
import type { Milestone, MilestoneDependency, MilestoneStatus, MilestonePriority, Team, Project } from '@/db/schema';

// Zoom level configuration
const ZOOM_CONFIG: Record<TimePeriod, { min: number; max: number }> = {
  week: { min: 30, max: 120 },
  month: { min: 60, max: 180 },
  quarter: { min: 60, max: 220 },
  year: { min: 60, max: 220 },
};

/**
 * Compute cascading shifts for end-to-start dependencies purely client-side.
 * BFS from the moved task through the successor adjacency list.
 * Returns inclusive end dates (matching DB convention).
 */
function computeLocalCascade(
  draggedId: string,
  newInclusiveEnd: Date,
  featureMap: Map<string, Milestone>,
  successorMap: Map<string, string[]>,
): Array<{ id: string; start: Date; end: Date }> {
  const updates: Array<{ id: string; start: Date; end: Date }> = [];
  const endOverrides = new Map<string, Date>();
  endOverrides.set(draggedId, newInclusiveEnd);

  const queue = [draggedId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentEnd = endOverrides.get(currentId);
    if (!currentEnd) continue;

    const successors = successorMap.get(currentId);
    if (!successors) continue;

    for (const successorId of successors) {
      const successor = featureMap.get(successorId);
      if (!successor) continue;

      const origStart = toLocalMidnight(successor.startDate);
      const origEnd = toLocalMidnight(successor.endDate);

      // End-to-start: successor must start at least 1 day after predecessor's inclusive end
      const requiredStart = addDays(currentEnd, 1);
      if (requiredStart > origStart) {
        const durationDays = differenceInDays(origEnd, origStart);
        const newEnd = addDays(requiredStart, durationDays);
        endOverrides.set(successorId, newEnd);
        updates.push({ id: successorId, start: requiredStart, end: newEnd });
        queue.push(successorId);
      }
    }
  }

  return updates;
}

interface SVARGanttViewProps {
  project: Project;
  features: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  onBack: () => void;
  onEdit: (feature: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (id: string, startDate: Date, endDate: Date) => Promise<CascadedUpdate[]>;
  onStatusChange: (id: string, status: MilestoneStatus) => Promise<void>;
  onPriorityChange?: (id: string, priority: MilestonePriority) => Promise<void>;
  onAddFeature: () => void;
  onCreateDependency: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency: (id: string) => Promise<void>;
}

export function SVARGanttView({
  project,
  features,
  dependencies,
  teams,
  onBack,
  onEdit,
  onUpdateDates,
  onAddFeature,
  onCreateDependency,
  onDeleteDependency,
}: SVARGanttViewProps) {
  const { setBreadcrumbs, clearBreadcrumbs, setHeaderAction, clearHeaderAction } = useHeader();

  // Per-milestone time period from store (persisted to localStorage)
  const timePeriod = useGanttStore((s) => s.getMilestoneTimePeriod(project.id)) as TimePeriod;
  const setMilestoneTimePeriod = useGanttStore((s) => s.setMilestoneTimePeriod);
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

  // Zoom anchoring: track cursor position so zooming keeps the date under cursor in place
  const cursorInfoRef = useRef<{ absoluteX: number; viewportX: number } | null>(null);
  const zoomAnchorRef = useRef<{ fractionalUnits: number; viewportX: number } | null>(null);

  const handleCursorMove = useCallback((info: { absoluteX: number; viewportX: number } | null) => {
    cursorInfoRef.current = info;
  }, []);

  // Set breadcrumbs
  useEffect(() => {
    setBreadcrumbs([{ label: project.name, onClick: onBack }]);
    return () => clearBreadcrumbs();
  }, [project.name, onBack, setBreadcrumbs, clearBreadcrumbs]);

  // Set header action
  useEffect(() => {
    setHeaderAction(
      <Button onClick={onAddFeature} size="sm">
        <Plus className="h-4 w-4 mr-1.5" />
        New Feature
      </Button>
    );
    return () => clearHeaderAction();
  }, [onAddFeature, setHeaderAction, clearHeaderAction]);

  // Sort and transform features
  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [features]);

  const tasks: SVARTask[] = useMemo(() => {
    return sortedFeatures.map(milestoneToSVARTask);
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

  // Successor adjacency list for local cascade computation (predecessorId → successorId[])
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
    // SVAR fires drag-task with pixel positions during drag, update-task on drop.
    // We call api.exec('update-task', { inProgress: true }) on dependent tasks so
    // SVAR renders both the shifted bars AND dependency arrows correctly.
    api.on('drag-task', (ev) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { id, left, width, inProgress } = ev as any;

      if (!inProgress || left == null || width == null) {
        // Drag ended — schedule revert in case of cancel.
        // If update-task fires (successful drop), the timeout is cancelled.
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

      // Get the original task data from our feature map
      const original = featureMapRef.current.get(taskId);
      if (!original) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = api.getState() as any;
      const scales = state?._scales;
      const cw = state?.cellWidth;
      if (!scales?.diff || !cw) return;

      const origStart = toLocalMidnight(original.startDate);
      const origEnd = toLocalMidnight(original.endDate);

      // Compute pixels-per-day using SVAR's scale math
      const oneDayLater = addDays(origStart, 1);
      const pixelsPerDay = scales.diff(oneDayLater, origStart, scales.lengthUnit) * cw;
      if (pixelsPerDay <= 0) return;

      // Compute new inclusive end from pixel end position (handles both move and resize)
      const origExclEnd = addDays(origEnd, 1); // inclusive → exclusive
      const origPixelEnd = Math.round(scales.diff(origExclEnd, scales.start, scales.lengthUnit) * cw);
      const newPixelEnd = left + width;
      const endDaysDelta = Math.round((newPixelEnd - origPixelEnd) / pixelsPerDay);

      if (endDaysDelta === 0 && cascadeOriginalsRef.current.size === 0) return;

      const newInclusiveEnd = addDays(origEnd, endDaysDelta);

      const cascade = computeLocalCascade(
        taskId,
        newInclusiveEnd,
        featureMapRef.current,
        successorMapRef.current,
      );

      // Skip if cascade result hasn't changed (avoid redundant api.exec calls)
      const cascadeKey = cascade.map((u) => `${u.id}:${u.start.getTime()}:${u.end.getTime()}`).join(',');
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

      // Apply cascade via SVAR's update-task (updates both bars and dependency arrows)
      for (const update of cascade) {
        const dep = featureMapRef.current.get(update.id);
        if (!dep) continue;

        // Save original SVAR-format dates if not already saved (for revert on cancel)
        if (!cascadeOriginalsRef.current.has(update.id)) {
          const origDepStart = toLocalMidnight(dep.startDate);
          const origDepEnd = addDays(toLocalMidnight(dep.endDate), 1); // inclusive → exclusive for SVAR
          cascadeOriginalsRef.current.set(update.id, { start: origDepStart, end: origDepEnd });
        }

        // Convert cascade result to SVAR exclusive end and update visually
        const svarEnd = addDays(update.end, 1); // inclusive → exclusive
        api.exec('update-task', { id: update.id, task: { start: update.start, end: svarEnd }, inProgress: true });
      }
    });

    // --- Drop: persist to server ---
    // SVAR fires update-task on drop with final task dates.
    // We skip cascade preview events (inProgress=true) and only persist the dropped task.
    // Server-side cascade will propagate dependent changes authoritatively.
    api.on('update-task', (ev) => {
      // Cancel revert timeout — drop was successful, not a cancel
      if (dropRevertTimeoutRef.current) {
        clearTimeout(dropRevertTimeoutRef.current);
        dropRevertTimeoutRef.current = null;
      }

      // Skip in-progress cascade preview updates (from our api.exec calls)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ev as any).inProgress) return;
      if (isDraggingRef.current) return;

      const taskId = String((ev as Record<string, unknown>).id ?? ev.task?.id);
      const task = ev.task;
      if (!taskId || !task?.start || !task?.end) return;

      // Clear cascade state — server-side cascade will provide authoritative updates
      cascadeOriginalsRef.current.clear();
      lastCascadeKeyRef.current = '';
      isDraggingRef.current = false;
      draggedTaskIdRef.current = null;

      const svarStart = task.start as Date;
      const inclusiveEnd = svarEndDateToInclusive(task.end as Date);
      onUpdateDatesRef.current(taskId, svarStart, inclusiveEnd);
    });

    api.on('add-link', (ev) => {
      const link = ev.link;
      if (link?.source && link.target) {
        onCreateDependency(link.source as string, link.target as string);
      }
    });

    api.on('delete-link', (ev) => {
      const link = ev.link;
      if (link?.source && link.target) {
        const dep = dependenciesRef.current.find(
          (d) => d.predecessorId === link.source && d.successorId === link.target
        );
        if (dep) {
          onDeleteDependency(dep.id);
        }
      }
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
  }, [onCreateDependency, onDeleteDependency]);

  // Scroll to today using SVAR's internal scales for accurate pixel calculation
  const scrollToToday = useCallback(() => {
    const api = ganttApiRef.current;
    const container = ganttContainerRef.current;
    if (!api || !container) return;

    const today = startOfDay(new Date());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = api.getState() as any;
    const scales = state?._scales;
    if (!scales?.diff || !scales.start || !scales.lengthUnit) return;

    // Use SVAR's own diff function to get today's pixel position
    const todayX = Math.round(scales.diff(today, scales.start, scales.lengthUnit) * state.cellWidth);
    if (todayX < 0) return;

    // .wx-area is the full-width content; its scrollable parent is the viewport
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

      // Compute zoom anchor directly from the wheel event's cursor position.
      // Reading scrollLeft here (synchronously in the event) guarantees the
      // value is current, unlike cursorInfoRef which may be stale.
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

      if (e.deltaY < 0) {
        setZoomLevel((p) => Math.min(9, p + 1));
      } else if (e.deltaY > 0) {
        setZoomLevel((p) => Math.max(1, p - 1));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // After cellWidth changes, scroll to keep the anchored point at the same viewport position.
  // Uses React's cellWidth (guaranteed correct) rather than SVAR's internal state (may lag).
  useEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    zoomAnchorRef.current = null;

    const container = ganttContainerRef.current;
    const api = ganttApiRef.current;
    if (!container || !api) return;

    // Recompute pixel position: same fractional units * new cellWidth
    const newPixelX = Math.round(anchor.fractionalUnits * cellWidth);
    const scrollTarget = Math.max(0, newPixelX - anchor.viewportX);

    const applyScroll = () => {
      const wxArea = container.querySelector('.wx-area') as HTMLElement;
      const sc = wxArea?.parentElement;
      if (!sc) return;
      sc.scrollLeft = scrollTarget;
      api.exec('scroll-chart', { left: scrollTarget });
    };

    // Apply immediately (before SVAR re-renders)
    applyScroll();
    // Re-apply after SVAR processes the new cellWidth prop
    const raf = requestAnimationFrame(applyScroll);

    return () => cancelAnimationFrame(raf);
  }, [cellWidth]);

  return (
    <div className="flex flex-col h-full min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
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

        <span className="text-sm text-muted-foreground">
          {sortedFeatures.length} feature{sortedFeatures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Main content - Let SVAR handle the grid and chart layout */}
      <div
        ref={ganttContainerRef}
        className="flex-1 min-h-0 svar-gantt-container relative"
        style={{
          '--gantt-cell-width': `${cellWidth}px`,
          '--gantt-row-height': `${ROW_HEIGHT}px`,
        } as React.CSSProperties}
      >
        <SVARThemeWrapper>
          <Gantt
            tasks={tasks}
            links={links}
            scales={scales}
            columns={[
              { id: 'text', header: 'Feature', width: 200, resize: true },
              { id: 'durationText', header: 'Duration', width: 80, resize: true },
            ]}
            cellWidth={cellWidth}
            cellHeight={ROW_HEIGHT}
            scaleHeight={SCALE_HEIGHT}
            start={TIMELINE_START_DATE}
            end={TIMELINE_END_DATE}
            cellBorders="full"
            highlightTime={highlightTime}
            init={initGantt}
          />
        </SVARThemeWrapper>

        {/* Custom Today Marker (SVAR markers are paywalled) */}
        <TodayMarker
          timelineStart={TIMELINE_START_DATE}
          timelineEnd={TIMELINE_END_DATE}
          timePeriod={timePeriod}
          cellWidth={cellWidth}
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
          className="absolute flex flex-col rounded-md border border-border bg-background/95 backdrop-blur-sm shadow-sm overflow-hidden"
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
