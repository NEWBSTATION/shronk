"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGanttStore, type TimePeriod } from "@/store/gantt-store";
import { statusConfig, priorityConfig, getStatusColor, getPriorityColor } from "@/components/shared/status-badge";
import type { Team } from "@/db/schema";
import {
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  GripVertical,
  Flag,
  Circle,
  Type,
  CalendarDays,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GanttToolbarProps {
  teams: Team[];
  onScrollToToday: () => void;
}

const timePeriodOptions: { value: TimePeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const sortOptions = [
  { value: "sortOrder", label: "Manual", icon: GripVertical },
  { value: "title", label: "Title", icon: Type },
  { value: "startDate", label: "Start Date", icon: CalendarDays },
  { value: "endDate", label: "End Date", icon: CalendarDays },
  { value: "priority", label: "Priority", icon: Flag },
  { value: "status", label: "Status", icon: Circle },
  { value: "createdAt", label: "Created", icon: Clock },
];

export function GanttToolbar({ teams, onScrollToToday }: GanttToolbarProps) {
  const {
    timePeriod,
    setTimePeriod,
    showDependencies,
    setShowDependencies,
    sidebarCollapsed,
    toggleSidebar,
    filters,
    setStatusFilter,
    setPriorityFilter,
    setTeamFilter,
    setSearchFilter,
    clearFilters,
    sortField,
    sortDirection,
    setSortField,
    toggleSortDirection,
  } = useGanttStore();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const activeFilterCount =
    (filters.status.length > 0 ? 1 : 0) +
    (filters.priority.length > 0 ? 1 : 0) +
    (filters.teamId.length > 0 ? 1 : 0);

  const handleStatusToggle = (status: string) => {
    if (filters.status.includes(status)) {
      setStatusFilter(filters.status.filter((s) => s !== status));
    } else {
      setStatusFilter([...filters.status, status]);
    }
  };

  const handlePriorityToggle = (priority: string) => {
    if (filters.priority.includes(priority)) {
      setPriorityFilter(filters.priority.filter((p) => p !== priority));
    } else {
      setPriorityFilter([...filters.priority, priority]);
    }
  };

  const handleTeamToggle = (teamId: string) => {
    if (filters.teamId.includes(teamId)) {
      setTeamFilter(filters.teamId.filter((t) => t !== teamId));
    } else {
      setTeamFilter([...filters.teamId, teamId]);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
      {/* Left Section */}
      <div className="flex items-center gap-1">
        {/* Sidebar Toggle */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        {/* Today Button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={onScrollToToday}
        >
          Today
        </Button>

        {/* Time Period */}
        <Select
          value={timePeriod}
          onValueChange={(v) => setTimePeriod(v as TimePeriod)}
        >
          <SelectTrigger className="h-7 w-[100px] text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
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

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Dependencies Toggle */}
        <Button
          variant={showDependencies ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-7 px-2.5 text-xs gap-1",
            showDependencies && "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          onClick={() => setShowDependencies(!showDependencies)}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Dependencies
        </Button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Active Filter Pills */}
        {filters.status.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 text-xs">
            <span>Status: {filters.status.length}</span>
            <button
              onClick={() => setStatusFilter([])}
              className="hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {filters.priority.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 text-xs">
            <span>Priority: {filters.priority.length}</span>
            <button
              onClick={() => setPriorityFilter([])}
              className="hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {filters.teamId.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 text-xs">
            <span>Team: {filters.teamId.length}</span>
            <button
              onClick={() => setTeamFilter([])}
              className="hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Sort Button */}
        <Popover open={isSortOpen} onOpenChange={setIsSortOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <div className="space-y-0.5">
              {sortOptions.map((option) => {
                const Icon = option.icon;
                const isActive = sortField === option.value;
                return (
                  <button
                    key={option.value}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => {
                      setSortField(option.value);
                      setIsSortOpen(false);
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                    {isActive && (
                      <span className="ml-auto">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t mt-1 pt-1">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={toggleSortDirection}
              >
                {sortDirection === "asc" ? (
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
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1 relative">
              <Filter className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={clearFilters}
                >
                  Clear all
                </Button>
              )}
            </div>

            <div className="p-3 space-y-4">
              {/* Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </span>
                  {filters.status.length > 0 && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setStatusFilter([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(statusConfig).map(([key, config]) => {
                    const isSelected = filters.status.includes(key);
                    return (
                      <button
                        key={key}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                          isSelected
                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "bg-secondary/80 text-muted-foreground hover:bg-secondary"
                        )}
                        onClick={() => handleStatusToggle(key)}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getStatusColor(key as keyof typeof statusConfig) }}
                        />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Priority
                  </span>
                  {filters.priority.length > 0 && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setPriorityFilter([])}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(priorityConfig).map(([key, config]) => {
                    const isSelected = filters.priority.includes(key);
                    return (
                      <button
                        key={key}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                          isSelected
                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "bg-secondary/80 text-muted-foreground hover:bg-secondary"
                        )}
                        onClick={() => handlePriorityToggle(key)}
                      >
                        <Flag
                          className="h-3 w-3"
                          style={{ color: isSelected ? undefined : getPriorityColor(key as keyof typeof priorityConfig) }}
                        />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Team */}
              {teams.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Team
                    </span>
                    {filters.teamId.length > 0 && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setTeamFilter([])}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className={cn(
                        "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors",
                        filters.teamId.includes("none")
                          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "bg-secondary/80 text-muted-foreground hover:bg-secondary"
                      )}
                      onClick={() => handleTeamToggle("none")}
                    >
                      No Team
                    </button>
                    {teams.map((team) => {
                      const isSelected = filters.teamId.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          className={cn(
                            "px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
                            isSelected
                              ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                              : "bg-secondary/80 text-muted-foreground hover:bg-secondary"
                          )}
                          onClick={() => handleTeamToggle(team.id)}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-7 w-40 pl-7 text-xs"
          />
          {filters.search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchFilter("")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
