"use client";

import { Table, GroupingState } from "@tanstack/react-table";
import { X, Layers, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";

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
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function FeaturesDataTableToolbar<TData>({
  table,
  milestoneOptions,
  grouping,
  onGroupingChange,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const isGrouped = grouping.length > 0;

  const statusColumn = table.getColumn("status");
  const milestoneColumn = table.getColumn("milestoneName");

  const selectedStatuses =
    (statusColumn?.getFilterValue() as string[]) || [];
  const selectedMilestones =
    (milestoneColumn?.getFilterValue() as string[]) || [];

  const toggleGroupByMilestone = () => {
    if (isGrouped) {
      onGroupingChange([]);
    } else {
      onGroupingChange(["milestoneName"]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search features..."
            value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("title")?.setFilterValue(event.target.value)
            }
            className="h-9 w-[200px] lg:w-[300px]"
          />

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="mr-2 h-4 w-4" />
                Status
                {selectedStatuses.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 rounded-sm px-1 font-normal"
                  >
                    {selectedStatuses.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedStatuses.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      statusColumn?.setFilterValue([
                        ...selectedStatuses,
                        option.value,
                      ]);
                    } else {
                      statusColumn?.setFilterValue(
                        selectedStatuses.filter((s) => s !== option.value)
                      );
                    }
                  }}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Milestone Filter */}
          {milestoneOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="mr-2 h-4 w-4" />
                  Milestone
                  {selectedMilestones.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-2 rounded-sm px-1 font-normal"
                    >
                      {selectedMilestones.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuLabel>Filter by milestone</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {milestoneOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={selectedMilestones.includes(option.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        milestoneColumn?.setFilterValue([
                          ...selectedMilestones,
                          option.id,
                        ]);
                      } else {
                        milestoneColumn?.setFilterValue(
                          selectedMilestones.filter((s) => s !== option.id)
                        );
                      }
                    }}
                  >
                    {option.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-9 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Group by Milestone Toggle */}
        <Toggle
          pressed={isGrouped}
          onPressedChange={toggleGroupByMilestone}
          aria-label="Group by milestone"
          className="h-9"
        >
          <Layers className="mr-2 h-4 w-4" />
          Group by Milestone
        </Toggle>
      </div>
    </div>
  );
}
