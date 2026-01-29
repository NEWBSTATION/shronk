"use client";

import { forwardRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/db/schema";

interface GanttSidebarProps {
  milestones: Milestone[];
  rowHeight: number;
  width: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onEdit: (milestone: Milestone) => void;
}

export const GanttSidebar = forwardRef<HTMLDivElement, GanttSidebarProps>(
  function GanttSidebar(
    { milestones, rowHeight, width, onScroll, onEdit },
    ref
  ) {
    return (
      <div
        className="border-r bg-background flex flex-col"
        style={{ width }}
      >
        {/* Header */}
        <div className="h-[72px] border-b flex items-end px-3 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Milestones
          </span>
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
                "flex items-center gap-2 px-3 border-b hover:bg-accent/50 cursor-pointer transition-colors"
              )}
              style={{ height: rowHeight }}
              onClick={() => onEdit(milestone)}
            >
              <StatusBadge status={milestone.status} showLabel={false} />
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
