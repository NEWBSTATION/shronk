"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { useGanttStore, type TimePeriod } from "@/store/gantt-store";
import { FilterToolbar } from "@/components/shared/filter-toolbar";
import type { Team } from "@/db/schema";
import {
  ZoomIn,
  ZoomOut,
  GitBranch,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

interface GanttToolbarProps {
  teams: Team[];
}

const timePeriodOptions: { value: TimePeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

export function GanttToolbar({ teams }: GanttToolbarProps) {
  const {
    timePeriod,
    setTimePeriod,
    zoomLevel,
    zoomIn,
    zoomOut,
    showDependencies,
    setShowDependencies,
    sidebarCollapsed,
    toggleSidebar,
  } = useGanttStore();

  return (
    <div className="flex items-center justify-between gap-4 pb-4 flex-wrap">
      <div className="flex items-center gap-2">
        {/* Sidebar Toggle */}
        <Button variant="outline" size="icon" onClick={toggleSidebar}>
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Time Period */}
        <Select
          value={timePeriod}
          onValueChange={(v) => setTimePeriod(v as TimePeriod)}
        >
          <SelectTrigger className="w-[100px]">
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

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={zoomOut}
            disabled={zoomLevel <= 1}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-sm text-muted-foreground">
            {zoomLevel}x
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={zoomIn}
            disabled={zoomLevel >= 10}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Dependencies Toggle */}
        <Toggle
          pressed={showDependencies}
          onPressedChange={setShowDependencies}
          className="gap-2"
        >
          <GitBranch className="h-4 w-4" />
          Dependencies
        </Toggle>
      </div>

      {/* Filters */}
      <FilterToolbar teams={teams} />
    </div>
  );
}
