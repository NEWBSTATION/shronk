"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGanttStore } from "@/store/gantt-store";
import { GanttChart, List } from "lucide-react";

export function ViewSwitcher() {
  const { viewType, setViewType } = useGanttStore();

  return (
    <ToggleGroup
      type="single"
      value={viewType}
      onValueChange={(value) => {
        if (value) setViewType(value as "gantt" | "list");
      }}
      className="bg-muted rounded-lg p-1"
    >
      <ToggleGroupItem
        value="gantt"
        aria-label="Gantt view"
        className="data-[state=on]:bg-background px-3"
      >
        <GanttChart className="h-4 w-4 mr-2" />
        Gantt
      </ToggleGroupItem>
      <ToggleGroupItem
        value="list"
        aria-label="List view"
        className="data-[state=on]:bg-background px-3"
      >
        <List className="h-4 w-4 mr-2" />
        List
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
