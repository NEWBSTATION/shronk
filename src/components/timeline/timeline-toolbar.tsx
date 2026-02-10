'use client';

import { useState, useMemo, useCallback } from 'react';
import { GitBranch, Calendar, Filter, X, Search, Circle, Clock, PauseCircle, CircleCheck, XCircle, Flag, Users, PanelLeftClose, PanelLeftOpen, ArrowUpDown, ArrowUp, ArrowDown, GripVertical, Type, CalendarDays, ZoomIn, ZoomOut } from 'lucide-react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TimelineToolbarProps, TimePeriod, SortByField } from './types';
import type { MilestoneStatus, MilestonePriority } from '@/db/schema';

const timePeriodOptions: { value: TimePeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const STATUS_CONFIG: Record<MilestoneStatus, { icon: typeof Circle; label: string; color: string }> = {
  not_started: { icon: Circle, label: 'Not Started', color: 'var(--status-not-started)' },
  in_progress: { icon: Clock, label: 'In Progress', color: 'var(--status-in-progress)' },
  on_hold: { icon: PauseCircle, label: 'On Hold', color: 'var(--status-on-hold)' },
  completed: { icon: CircleCheck, label: 'Completed', color: 'var(--status-completed)' },
  cancelled: { icon: XCircle, label: 'Cancelled', color: 'var(--status-cancelled)' },
};

const PRIORITY_CONFIG: Record<MilestonePriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'var(--priority-low)' },
  medium: { label: 'Medium', color: 'var(--priority-medium)' },
  high: { label: 'High', color: 'var(--priority-high)' },
  critical: { label: 'Critical', color: 'var(--priority-critical)' },
};

const SORT_OPTIONS: { value: SortByField; label: string; icon: typeof GripVertical }[] = [
  { value: 'sortOrder', label: 'Manual', icon: GripVertical },
  { value: 'title', label: 'Title', icon: Type },
  { value: 'startDate', label: 'Start Date', icon: Calendar },
  { value: 'endDate', label: 'End Date', icon: CalendarDays },
  { value: 'priority', label: 'Priority', icon: Flag },
  { value: 'status', label: 'Status', icon: Circle },
  { value: 'createdAt', label: 'Created', icon: Clock },
];

export function TimelineToolbar({
  timePeriod,
  onTimePeriodChange,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  showDependencies,
  onToggleDependencies,
  onScrollToToday,
  sidebarCollapsed,
  onToggleSidebar,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  teams,
  searchValue,
  onSearchChange,
}: TimelineToolbarProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.status.length > 0 ||
      filters.priority.length > 0 ||
      filters.teamIds.length > 0 ||
      filters.dateRange !== null
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.teamIds.length > 0) count++;
    if (filters.dateRange) count++;
    return count;
  }, [filters]);

  const toggleStatus = useCallback((status: MilestoneStatus) => {
    onFiltersChange({
      ...filters,
      status: filters.status.includes(status)
        ? filters.status.filter((s) => s !== status)
        : [...filters.status, status],
    });
  }, [filters, onFiltersChange]);

  const togglePriority = useCallback((priority: MilestonePriority) => {
    onFiltersChange({
      ...filters,
      priority: filters.priority.includes(priority)
        ? filters.priority.filter((p) => p !== priority)
        : [...filters.priority, priority],
    });
  }, [filters, onFiltersChange]);

  const toggleTeam = useCallback((teamId: string | null) => {
    onFiltersChange({
      ...filters,
      teamIds: filters.teamIds.includes(teamId)
        ? filters.teamIds.filter((t) => t !== teamId)
        : [...filters.teamIds, teamId],
    });
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      status: [],
      priority: [],
      teamIds: [],
      dateRange: null,
    });
  }, [onFiltersChange]);

  const clearStatusFilters = useCallback(() => {
    onFiltersChange({ ...filters, status: [] });
  }, [filters, onFiltersChange]);

  const clearPriorityFilters = useCallback(() => {
    onFiltersChange({ ...filters, priority: [] });
  }, [filters, onFiltersChange]);

  const clearTeamFilters = useCallback(() => {
    onFiltersChange({ ...filters, teamIds: [] });
  }, [filters, onFiltersChange]);

  const handleSortByChange = useCallback((sortBy: SortByField) => {
    onSortChange({ ...sort, sortBy });
    setSortMenuOpen(false);
  }, [sort, onSortChange]);

  const toggleSortDirection = useCallback(() => {
    onSortChange({ ...sort, sortDirection: sort.sortDirection === 'asc' ? 'desc' : 'asc' });
  }, [sort, onSortChange]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted min-w-0 overflow-hidden">
      <div className="flex items-center gap-1">
        {/* Sidebar collapse toggle */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Show milestones panel' : 'Hide milestones panel'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Today button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={onScrollToToday}
        >
          Today
        </Button>

        {/* Time period selector */}
        <Select value={timePeriod} onValueChange={(v) => onTimePeriodChange(v as TimePeriod)}>
          <SelectTrigger className="h-7 w-auto gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timePeriodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Separator */}
        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={onZoomOut}
            disabled={zoomLevel <= 1}
            title="Zoom out (Ctrl + scroll)"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center justify-center w-8 text-xs text-muted-foreground font-medium">
            {Math.round(zoomLevel * 10)}%
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={onZoomIn}
            disabled={zoomLevel >= 9}
            title="Zoom in (Ctrl + scroll)"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Dependencies toggle */}
        <Button
          variant={showDependencies ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs gap-1',
            showDependencies && 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
          onClick={onToggleDependencies}
        >
          <GitBranch className="h-3 w-3" />
          Dependencies
        </Button>
      </div>

      {/* Right side - Search and Filter */}
      <div className="flex items-center gap-2">
        {/* Active Filter Pills */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.status.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 text-xs">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">
                  {filters.status.length === 1
                    ? STATUS_CONFIG[filters.status[0]].label
                    : `${filters.status.length} selected`}
                </span>
                <button
                  onClick={clearStatusFilters}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.priority.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 text-xs">
                <span className="text-muted-foreground">Priority:</span>
                <span className="font-medium">
                  {filters.priority.length === 1
                    ? PRIORITY_CONFIG[filters.priority[0]].label
                    : `${filters.priority.length} selected`}
                </span>
                <button
                  onClick={clearPriorityFilters}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.teamIds.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 text-xs">
                <span className="text-muted-foreground">Team:</span>
                <span className="font-medium">
                  {filters.teamIds.length === 1
                    ? filters.teamIds[0] === null
                      ? 'No Team'
                      : teams.find((t) => t.id === filters.teamIds[0])?.name || 'Unknown'
                    : `${filters.teamIds.length} selected`}
                </span>
                <button
                  onClick={clearTeamFilters}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sort Button */}
        <Popover open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <div className="space-y-0.5">
              {SORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = sort.sortBy === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSortByChange(option.value)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                    {isSelected && (
                      <span className="ml-auto">
                        {sort.sortDirection === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t mt-1 pt-1">
              <button
                onClick={toggleSortDirection}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {sort.sortDirection === 'asc' ? (
                  <>
                    <ArrowUp className="h-3.5 w-3.5" />
                    Ascending
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3.5 w-3.5" />
                    Descending
                  </>
                )}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Filter Button */}
        <Popover open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filters</span>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
                {filters.status.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearStatusFilters}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(STATUS_CONFIG) as [MilestoneStatus, typeof STATUS_CONFIG[MilestoneStatus]][]).map(
                  ([value, config]) => {
                    const Icon = config.icon;
                    const isSelected = filters.status.includes(value);
                    return (
                      <button
                        key={value}
                        onClick={() => toggleStatus(value)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                      >
                        <Icon className="h-3 w-3" style={{ color: isSelected ? undefined : config.color }} />
                        {config.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Priority Filter */}
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</span>
                {filters.priority.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearPriorityFilters}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(PRIORITY_CONFIG) as [MilestonePriority, typeof PRIORITY_CONFIG[MilestonePriority]][]).map(
                  ([value, config]) => {
                    const isSelected = filters.priority.includes(value);
                    return (
                      <button
                        key={value}
                        onClick={() => togglePriority(value)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                      >
                        <Flag className="h-3 w-3" style={{ color: isSelected ? undefined : config.color }} />
                        {config.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Team Filter */}
            {teams.length > 0 && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</span>
                  {filters.teamIds.length > 0 && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={clearTeamFilters}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => toggleTeam(null)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                      filters.teamIds.includes(null)
                        ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                        : 'bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Users className="h-3 w-3" />
                    No Team
                  </button>
                  {teams.map((team) => {
                    const isSelected = filters.teamIds.includes(team.id);
                    return (
                      <button
                        key={team.id}
                        onClick={() => toggleTeam(team.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                            : 'bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        )}
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Separator */}
        <div className="h-4 w-px bg-border mx-1" />

        {/* Search Input - Far Right */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 w-40 pl-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
