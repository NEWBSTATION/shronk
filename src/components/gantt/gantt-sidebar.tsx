"use client";

import { forwardRef } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import type { Milestone } from "@/db/schema";

interface GanttSidebarProps {
  milestones: Milestone[];
  rowHeight: number;
  headerHeight: number;
  width: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onEdit: (milestone: Milestone) => void;
}

export const GanttSidebar = forwardRef<HTMLDivElement, GanttSidebarProps>(
  function GanttSidebar(
    { milestones, rowHeight, headerHeight, width, onScroll, onEdit },
    ref
  ) {
    return (
      <div
        className="border-r bg-background flex flex-col flex-shrink-0"
        style={{ width }}
      >
        {/* Header */}
        <div
          className="flex items-end px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b bg-muted/30"
          style={{ height: headerHeight }}
        >
          <span className="pb-2">Milestones</span>
        </div>

        {/* Items */}
        <div
          ref={ref}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={onScroll}
        >
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={cn(
                "flex items-center gap-2 px-3 border-b hover:bg-muted/50 cursor-pointer transition-colors group"
              )}
              style={{ height: rowHeight }}
              onClick={() => onEdit(milestone)}
            >
              {/* Drag handle */}
              <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Status icon */}
              <StatusBadge status={milestone.status} showLabel={false} />

              {/* Title */}
              <span className="truncate text-sm font-medium flex-1">
                {milestone.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
