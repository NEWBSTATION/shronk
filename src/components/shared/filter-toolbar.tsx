"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTimelineStore } from "@/store/timeline-store";
import { statusConfig, priorityConfig } from "./status-badge";
import type { Team } from "@/db/schema";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  SortAsc,
  SortDesc,
  Rows3,
  Rows4,
  SquareStack,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterToolbarProps {
  teams?: Team[];
}

const sortOptions = [
  { value: "sortOrder", label: "Manual Order" },
  { value: "title", label: "Title" },
  { value: "startDate", label: "Start Date" },
  { value: "endDate", label: "End Date" },
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
];

const groupByOptions = [
  { value: "none", label: "No Grouping" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "team", label: "Team" },
];

export function FilterToolbar({ teams = [] }: FilterToolbarProps) {
  const {
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
    groupBy,
    setGroupBy,
    viewType,
    rowHeight,
    setRowHeight,
  } = useTimelineStore();

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFilterCount =
    filters.status.length +
    filters.priority.length +
    filters.teamId.length +
    (filters.search ? 1 : 0);

  const handleStatusChange = (status: string, checked: boolean) => {
    if (checked) {
      setStatusFilter([...filters.status, status]);
    } else {
      setStatusFilter(filters.status.filter((s) => s !== status));
    }
  };

  const handlePriorityChange = (priority: string, checked: boolean) => {
    if (checked) {
      setPriorityFilter([...filters.priority, priority]);
    } else {
      setPriorityFilter(filters.priority.filter((p) => p !== priority));
    }
  };

  const handleTeamChange = (teamId: string, checked: boolean) => {
    if (checked) {
      setTeamFilter([...filters.teamId, teamId]);
    } else {
      setTeamFilter(filters.teamId.filter((t) => t !== teamId));
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-9 w-[200px]"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => setSearchFilter("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${key}`}
                      checked={filters.status.includes(key)}
                      onCheckedChange={(checked) =>
                        handleStatusChange(key, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`status-${key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {config.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Priority</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`priority-${key}`}
                      checked={filters.priority.includes(key)}
                      onCheckedChange={(checked) =>
                        handlePriorityChange(key, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`priority-${key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {config.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {teams.length > 0 && (
              <>
                <Separator />
                {/* Team */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Team</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="team-none"
                        checked={filters.teamId.includes("none")}
                        onCheckedChange={(checked) =>
                          handleTeamChange("none", checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="team-none"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Unassigned
                      </Label>
                    </div>
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={filters.teamId.includes(team.id)}
                          onCheckedChange={(checked) =>
                            handleTeamChange(team.id, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`team-${team.id}`}
                          className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {activeFilterCount > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  clearFilters();
                  setIsFilterOpen(false);
                }}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <div className="flex items-center gap-1">
        <Select value={sortField} onValueChange={setSortField}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={toggleSortDirection}>
          {sortDirection === "asc" ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Group By (List View Only) */}
      {viewType === "list" && (
        <Select
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as "none" | "status" | "priority" | "team")}
        >
          <SelectTrigger className="w-[140px]">
            <SquareStack className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            {groupByOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Row Height (List View Only) */}
      {viewType === "list" && (
        <div className="flex items-center border rounded-lg overflow-hidden">
          <Button
            variant={rowHeight === "compact" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none h-9"
            onClick={() => setRowHeight("compact")}
          >
            <Rows4 className="h-4 w-4" />
          </Button>
          <Button
            variant={rowHeight === "default" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none h-9"
            onClick={() => setRowHeight("default")}
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
