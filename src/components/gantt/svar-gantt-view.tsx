'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { differenceInDays, differenceInWeeks, differenceInMonths, differenceInQuarters, startOfDay, startOfWeek, startOfMonth, startOfQuarter } from 'date-fns';
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
  const ganttContainerRef = useRef<HTMLDivElement>(null);

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

  // Calculate today's position in pixels
  const calculateTodayPosition = useCallback((): number => {
    const today = startOfDay(new Date());

    if (today < TIMELINE_START_DATE || today > TIMELINE_END_DATE) {
      return -1;
    }

    switch (timePeriod) {
      case 'week': {
        const daysFromStart = differenceInDays(today, TIMELINE_START_DATE);
        return daysFromStart * cellWidth;
      }
      case 'month': {
        const timelineStartWeek = startOfWeek(TIMELINE_START_DATE, { weekStartsOn: 0 });
        const todayWeek = startOfWeek(today, { weekStartsOn: 0 });
        const weeksFromStart = differenceInWeeks(todayWeek, timelineStartWeek);
        const daysIntoWeek = differenceInDays(today, todayWeek);
        const fractionOfWeek = daysIntoWeek / 7;
        return (weeksFromStart + fractionOfWeek) * cellWidth;
      }
      case 'quarter': {
        const timelineStartMonth = startOfMonth(TIMELINE_START_DATE);
        const todayMonth = startOfMonth(today);
        const monthsFromStart = differenceInMonths(todayMonth, timelineStartMonth);
        const daysIntoMonth = differenceInDays(today, todayMonth);
        const daysInMonth = differenceInDays(
          new Date(today.getFullYear(), today.getMonth() + 1, 0),
          todayMonth
        ) + 1;
        const fractionOfMonth = daysIntoMonth / daysInMonth;
        return (monthsFromStart + fractionOfMonth) * cellWidth;
      }
      case 'year': {
        const timelineStartQuarter = startOfQuarter(TIMELINE_START_DATE);
        const todayQuarter = startOfQuarter(today);
        const quartersFromStart = differenceInQuarters(todayQuarter, timelineStartQuarter);
        const quarterStart = startOfQuarter(today);
        const nextQuarterStart = new Date(quarterStart);
        nextQuarterStart.setMonth(nextQuarterStart.getMonth() + 3);
        const daysIntoQuarter = differenceInDays(today, quarterStart);
        const daysInQuarter = differenceInDays(nextQuarterStart, quarterStart);
        const fractionOfQuarter = daysIntoQuarter / daysInQuarter;
        return (quartersFromStart + fractionOfQuarter) * cellWidth;
      }
      default:
        return -1;
    }
  }, [timePeriod, cellWidth]);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    setTimeout(() => {
      const container = ganttContainerRef.current;
      if (!container) return;

      const todayPosition = calculateTodayPosition();
      if (todayPosition < 0) return;

      // Find the horizontal scroll container (wx-area) and scroll it
      const scrollArea = container.querySelector('.wx-area') as HTMLElement;
      if (scrollArea) {
        const viewportWidth = scrollArea.clientWidth;
        const scrollTarget = Math.max(0, todayPosition - viewportWidth / 2);
        scrollArea.scrollTo({ left: scrollTarget, behavior: 'smooth' });
        return;
      }

      // Fallback: find any horizontally scrollable element
      const allElements = container.querySelectorAll('*');
      for (const el of allElements) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.scrollWidth > htmlEl.clientWidth + 50) {
          const viewportWidth = htmlEl.clientWidth;
          const scrollTarget = Math.max(0, todayPosition - viewportWidth / 2);
          htmlEl.scrollTo({ left: scrollTarget, behavior: 'smooth' });
          break;
        }
      }
    }, 100);
  }, [calculateTodayPosition]);

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
              { id: 'text', header: 'Feature', width: 200, resize: true }
            ]}
            cellWidth={cellWidth}
            cellHeight={ROW_HEIGHT}
            scaleHeight={SCALE_HEIGHT}
            start={TIMELINE_START_DATE}
            end={TIMELINE_END_DATE}
            cellBorders="full"
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
