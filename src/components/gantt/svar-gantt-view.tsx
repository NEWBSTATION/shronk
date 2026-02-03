'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import { milestoneToSVARTask } from './transformers';
import { SCALE_CONFIGS, ROW_HEIGHT, SCALE_HEIGHT } from './scales-config';
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from './constants';
import type { TimePeriod, SVARTask, SVARLink } from './types';
import type { Milestone, MilestoneStatus, MilestonePriority, Team, Project } from '@/db/schema';

// Zoom level configuration
const ZOOM_CONFIG: Record<TimePeriod, { min: number; max: number }> = {
  week: { min: 30, max: 120 },
  month: { min: 60, max: 180 },
  quarter: { min: 60, max: 220 },
  year: { min: 60, max: 220 },
};

interface SVARGanttViewProps {
  project: Project;
  features: Milestone[];
  teams: Team[];
  onBack: () => void;
  onEdit: (feature: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (id: string, startDate: Date, endDate: Date) => Promise<void>;
  onStatusChange: (id: string, status: MilestoneStatus) => Promise<void>;
  onPriorityChange?: (id: string, priority: MilestonePriority) => Promise<void>;
  onAddFeature: () => void;
}

export function SVARGanttView({
  project,
  features,
  teams,
  onBack,
  onEdit,
  onUpdateDates,
  onAddFeature,
}: SVARGanttViewProps) {
  const { setBreadcrumbs, clearBreadcrumbs, setHeaderAction, clearHeaderAction } = useHeader();

  // State
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [zoomLevel, setZoomLevel] = useState(5);
  const [showDependencies, setShowDependencies] = useState(true);

  // Refs
  const ganttApiRef = useRef<IApi | null>(null);

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
    return showDependencies ? [] : [];
  }, [showDependencies]);

  // Feature lookup map
  const featureMap = useMemo(() => {
    const map = new Map<string, Milestone>();
    features.forEach((f) => map.set(f.id, f));
    return map;
  }, [features]);

  // Scale and cell width
  const scales = useMemo(() => SCALE_CONFIGS[timePeriod], [timePeriod]);

  const cellWidth = useMemo(() => {
    const { min, max } = ZOOM_CONFIG[timePeriod];
    return Math.round(min + (max - min) * ((zoomLevel - 1) / 8));
  }, [zoomLevel, timePeriod]);

  // Today marker
  const markers = useMemo(() => {
    const today = new Date();
    if (today >= TIMELINE_START_DATE && today <= TIMELINE_END_DATE) {
      return [{ start: today, text: 'Today' }];
    }
    return [];
  }, []);

  // SVAR columns configuration - use SVAR's built-in grid
  const columns = useMemo(() => [
    {
      id: 'text',
      header: 'Feature',
      width: 250,
      align: 'left' as const,
    },
  ], []);

  // Initialize Gantt API
  const initGantt = useCallback((api: IApi) => {
    ganttApiRef.current = api;

    api.on('update-task', (ev) => {
      const task = ev.task;
      if (task?.id && task.start && task.end) {
        onUpdateDates(task.id as string, task.start as Date, task.end as Date);
      }
    });

    api.intercept('open-task-editor', (ev) => {
      if (ev.id) {
        const feature = featureMap.get(ev.id as string);
        if (feature) onEdit(feature);
      }
      return false;
    });
  }, [featureMap, onEdit, onUpdateDates]);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    ganttApiRef.current?.exec('scroll-chart', { date: new Date() });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(scrollToToday, 200);
    return () => clearTimeout(timeout);
  }, [scrollToToday]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => setZoomLevel((p) => Math.min(9, p + 1)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((p) => Math.max(1, p - 1)), []);

  return (
    <div className="flex flex-col h-full min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={scrollToToday}>
            Today
          </Button>

          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center border border-border rounded-md">
            <button
              className="px-2 py-1 hover:bg-muted disabled:opacity-50"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 py-1 text-xs text-muted-foreground min-w-[40px] text-center">
              {Math.round((zoomLevel / 9) * 100)}%
            </span>
            <button
              className="px-2 py-1 hover:bg-muted disabled:opacity-50"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 9}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            variant={showDependencies ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowDependencies(!showDependencies)}
          >
            <GitBranch className="h-4 w-4 mr-1.5" />
            Dependencies
          </Button>
        </div>

        <span className="text-sm text-muted-foreground">
          {sortedFeatures.length} feature{sortedFeatures.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Gantt Chart - uses SVAR's built-in grid */}
      <div
        className="flex-1 min-h-0 svar-gantt-container"
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
            columns={columns}
            cellWidth={cellWidth}
            cellHeight={ROW_HEIGHT}
            scaleHeight={SCALE_HEIGHT}
            start={TIMELINE_START_DATE}
            end={TIMELINE_END_DATE}
            markers={markers}
            cellBorders="full"
            init={initGantt}
          />
        </SVARThemeWrapper>
      </div>
    </div>
  );
}
