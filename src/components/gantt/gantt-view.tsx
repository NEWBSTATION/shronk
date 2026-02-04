'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Gantt } from '@svar-ui/react-gantt';
import type { IApi } from '@svar-ui/react-gantt';
import { GripVertical, Circle, Clock, PauseCircle, CheckCircle2, XCircle, ChevronRight, Plus, Minus } from 'lucide-react';
import { GanttToolbar } from './gantt-toolbar';
import { MilestoneContextMenu } from './milestone-context-menu';
import { SVARThemeWrapper } from './svar-theme-wrapper';
import { TodayMarker } from './today-marker';
import { milestoneToSVARTask, dependencyToSVARLink, toLocalMidnight } from './transformers';
import { SCALE_CONFIGS, calculateCellWidth, ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import {
  SIDEBAR_WIDTH,
  STATUS_CONFIG,
  TIMELINE_START_DATE,
  TIMELINE_END_DATE,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
} from './constants';
import type {
  GanttViewProps,
  TimePeriod,
  GanttFilters,
  GanttSort,
  MilestoneWithDeps,
  SVARTask,
  SVARLink,
} from './types';
import type { Milestone, MilestoneStatus, MilestonePriority } from '@/db/schema';

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

  // Refs
  const sidebarRef = useRef<HTMLDivElement>(null);
  const ganttApiRef = useRef<IApi | null>(null);

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

  // Transform filtered milestones to SVAR tasks
  const tasks: SVARTask[] = useMemo(() => {
    return filteredMilestones.map(milestoneToSVARTask);
  }, [filteredMilestones]);

  // Transform dependencies to SVAR links (only visible ones based on filtered milestones)
  const links: SVARLink[] = useMemo(() => {
    if (!showDependencies) return [];

    const filteredIds = new Set(filteredMilestones.map((m) => m.id));

    return dependencies
      .filter((d) => filteredIds.has(d.predecessorId) && filteredIds.has(d.successorId))
      .map(dependencyToSVARLink);
  }, [dependencies, showDependencies, filteredMilestones]);

  // Get scale configuration for current time period
  const scales = useMemo(() => SCALE_CONFIGS[timePeriod], [timePeriod]);

  // Calculate cell width based on zoom level
  const cellWidth = useMemo(() => calculateCellWidth(zoomLevel, timePeriod), [zoomLevel, timePeriod]);

  // Create a milestone lookup map for event handlers
  const milestoneMap = useMemo(() => {
    const map = new Map<string, Milestone>();
    milestones.forEach((m) => map.set(m.id, m));
    return map;
  }, [milestones]);

  // Initialize SVAR API and set up event listeners
  const initGantt = useCallback((api: IApi) => {
    ganttApiRef.current = api;

    // Listen for task updates (drag, resize)
    api.on('update-task', (ev) => {
      const task = ev.task;
      if (task?.id && task.start && task.end) {
        onUpdateDates(task.id as string, task.start, task.end);
      }
    });

    // Listen for link additions
    api.on('add-link', (ev) => {
      const link = ev.link;
      if (link?.source && link.target) {
        onCreateDependency(link.source as string, link.target as string);
      }
    });

    // Listen for link deletions
    api.on('delete-link', (ev) => {
      const link = ev.link;
      if (link?.source && link.target) {
        const dep = dependencies.find(
          (d) => d.predecessorId === link.source && d.successorId === link.target
        );
        if (dep) {
          onDeleteDependency(dep.id);
        }
      }
    });

    // Listen for task selection (double-click to edit)
    api.on('select-task', (ev) => {
      if (ev.id) {
        const milestone = milestoneMap.get(ev.id as string);
        if (milestone) {
          onEdit(milestone);
        }
      }
    });
  }, [dependencies, milestoneMap, onCreateDependency, onDeleteDependency, onEdit, onUpdateDates]);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (ganttApiRef.current) {
      const today = new Date();
      // Use SVAR API to scroll to today
      ganttApiRef.current.exec('scroll-chart', { date: today });
    }
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    // Use a small delay to ensure SVAR is fully initialized
    const timeout = setTimeout(() => {
      scrollToToday();
    }, 100);
    return () => clearTimeout(timeout);
  }, [scrollToToday]);

  // Handle sidebar scroll sync
  const handleSidebarScroll = useCallback(() => {
    // We'll sync with SVAR's internal scroll when available
  }, []);

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <GanttToolbar
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
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
        {/* Sidebar - Custom milestone list */}
        {!sidebarCollapsed && (
          <div
            className="flex flex-col border-r border-border bg-background flex-shrink-0"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Sidebar header */}
            <div
              className="flex items-center px-3 border-b border-border bg-muted/50"
              style={{ height: SCALE_HEIGHT }}
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

        {/* SVAR Gantt Chart */}
        <div
          className="flex-1 overflow-hidden relative svar-gantt-container"
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
              cellWidth={cellWidth}
              cellHeight={ROW_HEIGHT}
              scaleHeight={SCALE_HEIGHT}
              start={TIMELINE_START_DATE}
              end={TIMELINE_END_DATE}
              init={initGantt}
              // Disable built-in grid since we have custom sidebar
              columns={[]}
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
              onClick={() => setZoomLevel((prev) => Math.min(ZOOM_MAX, prev + 1))}
              disabled={zoomLevel >= ZOOM_MAX}
              title="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="h-px bg-border" />
            <button
              className="flex items-center justify-center w-6 h-6 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={() => setZoomLevel((prev) => Math.max(ZOOM_MIN, prev - 1))}
              disabled={zoomLevel <= ZOOM_MIN}
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
