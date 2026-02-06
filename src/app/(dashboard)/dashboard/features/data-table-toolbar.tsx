"use client";

import { Table, GroupingState } from "@tanstack/react-table";
import {
  Layers2,
  Filter,
  Circle,
  Clock,
  PauseCircle,
  CircleCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MilestoneOption {
  id: string;
  name: string;
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  milestoneOptions: MilestoneOption[];
  grouping: GroupingState;
  onGroupingChange: (grouping: GroupingState) => void;
}

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", icon: Circle, className: "text-slate-500" },
  { value: "in_progress", label: "In Progress", icon: Clock, className: "text-blue-500" },
  { value: "on_hold", label: "On Hold", icon: PauseCircle, className: "text-amber-500" },
  { value: "completed", label: "Completed", icon: CircleCheck, className: "text-green-500" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, className: "text-red-400" },
];

export function FeaturesDataTableToolbar<TData>({
  table,
  milestoneOptions,
  grouping,
  onGroupingChange,
}: DataTableToolbarProps<TData>) {
  const isGrouped = grouping.length > 0;

  const statusColumn = table.getColumn("status");
  const milestoneColumn = table.getColumn("milestoneName");

  const selectedStatuses =
    (statusColumn?.getFilterValue() as string[]) || [];
  const selectedMilestones =
    (milestoneColumn?.getFilterValue() as string[]) || [];

  const activeFilterCount = selectedStatuses.length + selectedMilestones.length;

  const toggleGroupByMilestone = () => {
    if (isGrouped) {
      onGroupingChange([]);
    } else {
      onGroupingChange(["milestoneName"]);
    }
  };

  const toggleStatus = (value: string) => {
    if (selectedStatuses.includes(value)) {
      statusColumn?.setFilterValue(
        selectedStatuses.filter((s) => s !== value)
      );
    } else {
      statusColumn?.setFilterValue([...selectedStatuses, value]);
    }
  };

  const toggleMilestone = (id: string) => {
    if (selectedMilestones.includes(id)) {
      milestoneColumn?.setFilterValue(
        selectedMilestones.filter((s) => s !== id)
      );
    } else {
      milestoneColumn?.setFilterValue([...selectedMilestones, id]);
    }
  };

  const clearAllFilters = () => {
    table.resetColumnFilters();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Group by Milestone — far left */}
      <Button
        variant={isGrouped ? "secondary" : "outline"}
        size="sm"
        onClick={toggleGroupByMilestone}
        className="h-7 text-xs"
      >
        <Layers2 className="mr-1 h-3.5 w-3.5" />
        <span className="text-muted-foreground">Group by</span> Milestone
      </Button>

      {/* Right side: Filter + Search */}
      <div className="flex items-center gap-2 ml-auto">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Filter className="mr-1 h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 rounded-sm px-1 font-normal"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[220px] p-3">
          {/* Status Section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Status
            </Label>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedStatuses.includes(option.value)}
                      onCheckedChange={() => toggleStatus(option.value)}
                    />
                    <Icon className={cn("h-3.5 w-3.5", option.className)} />
                    <span className="text-xs">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Milestone Section */}
          {milestoneOptions.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Milestone
                </Label>
                <div className="space-y-1.5">
                  {milestoneOptions.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMilestones.includes(option.id)}
                        onCheckedChange={() => toggleMilestone(option.id)}
                      />
                      <span className="text-xs">{option.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <>
              <Separator className="my-3" />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-7 w-full text-xs"
              >
                Clear filters
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>

      <div className="h-5 w-px shrink-0 bg-border" />

      {/* Search */}
      <Input
        placeholder="Search features..."
        value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
        onChange={(event) =>
          table.getColumn("title")?.setFilterValue(event.target.value)
        }
        className="h-7 w-[200px] lg:w-[300px] text-xs"
      />
      </div>
    </div>
  );
}
