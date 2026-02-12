import type { Milestone, MilestoneStatus, MilestonePriority, MilestoneDependency, Team } from '@/db/schema';

// Time period types (matches ClickUp: Week, Month, Quarter, Year)
export type TimePeriod = 'week' | 'month' | 'quarter' | 'year';

// ================================================
// SVAR React Gantt Types
// ================================================

/**
 * SVAR Task type - the format expected by @svar-ui/react-gantt
 */
export interface SVARTask {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  durationText: string;
  progress: number;
  type: 'task' | 'summary' | 'milestone';
  parent?: string;
  open?: boolean;
  $custom?: {
    status: MilestoneStatus;
    priority: MilestonePriority;
    projectId: string;
    sortOrder: number;
    description: string | null;
    isTeamTrack?: boolean;
    teamColor?: string;
    teamName?: string;
  };
}

/**
 * SVAR Link type - for dependencies
 */
export interface SVARLink {
  id: string;
  source: string;
  target: string;
  type: 'e2s' | 's2s' | 'e2e' | 's2e'; // end-to-start, start-to-start, end-to-end, start-to-end
}

/**
 * SVAR Scale configuration
 */
export interface SVARScale {
  unit: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  step: number;
  format: string | ((date: Date) => string);
}

/**
 * SVAR Action event data
 */
export interface SVARActionEvent {
  action: string;
  data: SVARTask | SVARLink | { id: string } | Record<string, unknown>;
}
export type ZoomLevel = number; // 1-10
export type DragType = 'move' | 'resize-start' | 'resize-end' | null;

// Milestone with computed dependencies for Timeline display
export interface MilestoneWithDeps extends Milestone {
  dependencies: Array<{ id: string }>;
}

// Drag state for bar manipulation
export interface DragState {
  type: DragType;
  milestoneId: string;
  initialMouseX: number;
  initialLeft: number;
  initialWidth: number;
  initialStartDate: Date;
  initialEndDate: Date;
  initialScrollLeft: number;
  hasMoved: boolean;
}

// Preview dates during drag operations
export interface PreviewDates {
  startDate: Date;
  endDate: Date;
}

// Connection handle side for dependencies
export type ConnectionSide = 'start' | 'end';

// Dependency creation state
export interface DependencyCreationState {
  fromMilestoneId: string;
  fromSide: ConnectionSide;
  fromX: number;
  fromY: number;
  currentX: number;
  currentY: number;
}

// Filter state
export interface TimelineFilters {
  status: MilestoneStatus[];
  priority: MilestonePriority[];
  teamIds: (string | null)[];
  dateRange: { start: Date; end: Date } | null;
}

// Sort state
export interface TimelineSort {
  sortBy: SortByField;
  sortDirection: 'asc' | 'desc';
}

// Sort field options
export type SortByField = 'sortOrder' | 'title' | 'startDate' | 'endDate' | 'priority' | 'status' | 'createdAt';

// Time period configuration (ClickUp-style)
export interface TimePeriodConfig {
  minSubColumnWidth: number;  // Width at zoom level 1 (min)
  maxSubColumnWidth: number;  // Width at zoom level 9 (max)
  daysPerSubColumn: number;   // How many days each sub-column represents
}

// Bar position calculation result
export interface BarPosition {
  left: number;
  width: number;
}

// Dependency line for rendering
export interface DependencyLine {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// Status configuration for visual styling
export interface StatusConfig {
  bgColor: string;
  textColor: string;
  label: string;
}

// TimelineBar component props
export interface TimelineBarProps {
  milestone: Milestone;
  left: number;
  width: number;
  isDragging: boolean;
  isEditable: boolean;
  onMouseDown: (e: React.MouseEvent, type: DragType) => void;
  onClick: () => void;
  onDependencyDragStart?: (e: React.MouseEvent, side: ConnectionSide) => void;
  showConnectionHandles?: boolean;
}

// TimelineToolbar component props
export interface TimelineToolbarProps {
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showDependencies: boolean;
  onToggleDependencies: () => void;
  onScrollToToday: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  sort: TimelineSort;
  onSortChange: (sort: TimelineSort) => void;
  teams: Team[];
  searchValue: string;
  onSearchChange: (value: string) => void;
}

// DependencyLines component props
export interface DependencyLinesProps {
  milestones: MilestoneWithDeps[];
  getBarPosition: (milestone: Milestone) => BarPosition;
  rowHeight: number;
  onDependencyClick?: (fromId: string, toId: string) => void;
  creationState?: DependencyCreationState | null;
}

// Main TimelineView component props
export interface TimelineViewProps {
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  teams: Team[];
  projectId: string;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onUpdateDates: (id: string, startDate: Date, endDate: Date) => Promise<void>;
  onStatusChange: (id: string, status: MilestoneStatus) => Promise<void>;
  onPriorityChange: (id: string, priority: MilestonePriority) => Promise<void>;
  onCreateDependency: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency: (id: string) => Promise<void>;
}
