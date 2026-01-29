"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { getStatusColor } from "@/components/shared/status-badge";
import { ItemContextMenu } from "@/components/shared/item-context-menu";
import { dateFromPosition, toLocalMidnight } from "./utils/date-calculations";
import { format, addDays, differenceInDays } from "date-fns";
import type { Milestone, Team, MilestoneStatus, MilestonePriority } from "@/db/schema";
import type { BarPosition } from "./utils/date-calculations";

interface GanttBarProps {
  milestone: Milestone;
  team?: Team;
  position: BarPosition;
  rowIndex: number;
  rowHeight: number;
  dayWidth: number;
  timelineStart: Date;
  onEdit: () => void;
  onUpdateDates: (startDate: Date, endDate: Date) => void;
  onStatusChange: (status: MilestoneStatus) => void;
  onPriorityChange: (priority: MilestonePriority) => void;
  onDelete: () => void;
}

type DragMode = "move" | "resize-start" | "resize-end" | null;

interface DragState {
  mode: DragMode;
  startX: number;
  originalLeft: number;
  originalWidth: number;
  originalStartDate: Date;
  originalEndDate: Date;
}

const CLICK_THRESHOLD = 5;
const BAR_PADDING = 6;
const BAR_HEIGHT = 32;
const RESIZE_HANDLE_WIDTH = 8;

export function GanttBar({
  milestone,
  team,
  position,
  rowIndex,
  rowHeight,
  dayWidth,
  timelineStart,
  onEdit,
  onUpdateDates,
  onStatusChange,
  onPriorityChange,
  onDelete,
}: GanttBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewDates, setPreviewDates] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const statusColor = getStatusColor(milestone.status);
  const top = rowIndex * rowHeight + (rowHeight - BAR_HEIGHT) / 2;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();

      dragStartPos.current = { x: e.clientX, y: e.clientY };

      setDragState({
        mode,
        startX: e.clientX,
        originalLeft: position.left,
        originalWidth: position.width,
        originalStartDate: toLocalMidnight(milestone.startDate),
        originalEndDate: toLocalMidnight(milestone.endDate),
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartPos.current) return;

        const deltaX = moveEvent.clientX - dragStartPos.current.x;
        const totalMovement = Math.sqrt(
          Math.pow(moveEvent.clientX - dragStartPos.current.x, 2) +
            Math.pow(moveEvent.clientY - dragStartPos.current.y, 2)
        );

        // Only start dragging after threshold
        if (totalMovement > CLICK_THRESHOLD) {
          setIsDragging(true);

          const daysDelta = Math.round(deltaX / dayWidth);
          const originalStart = toLocalMidnight(milestone.startDate);
          const originalEnd = toLocalMidnight(milestone.endDate);
          const duration = differenceInDays(originalEnd, originalStart);

          let newStart: Date;
          let newEnd: Date;

          if (mode === "move") {
            newStart = addDays(originalStart, daysDelta);
            newEnd = addDays(originalEnd, daysDelta);
          } else if (mode === "resize-start") {
            newStart = addDays(originalStart, daysDelta);
            newEnd = originalEnd;
            // Don't allow start to go past end
            if (newStart > newEnd) {
              newStart = newEnd;
            }
          } else {
            // resize-end
            newStart = originalStart;
            newEnd = addDays(originalEnd, daysDelta);
            // Don't allow end to go before start
            if (newEnd < newStart) {
              newEnd = newStart;
            }
          }

          setPreviewDates({ start: newStart, end: newEnd });
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        if (!dragStartPos.current) return;

        const totalMovement = Math.sqrt(
          Math.pow(upEvent.clientX - dragStartPos.current.x, 2) +
            Math.pow(upEvent.clientY - dragStartPos.current.y, 2)
        );

        // If it was a click, open edit
        if (totalMovement <= CLICK_THRESHOLD) {
          onEdit();
        } else if (previewDates) {
          // Commit the drag
          onUpdateDates(previewDates.start, previewDates.end);
        }

        setIsDragging(false);
        setDragState(null);
        setPreviewDates(null);
        dragStartPos.current = null;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [position, milestone, dayWidth, onEdit, onUpdateDates, previewDates]
  );

  // Calculate display position
  const displayLeft = previewDates
    ? differenceInDays(previewDates.start, timelineStart) * dayWidth
    : position.left;
  const displayWidth = previewDates
    ? (differenceInDays(previewDates.end, previewDates.start) + 1) * dayWidth
    : position.width;

  // Diamond for single-day items
  if (position.isSingleDay && !previewDates) {
    return (
      <ItemContextMenu
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onPriorityChange={onPriorityChange}
        currentStatus={milestone.status}
        currentPriority={milestone.priority}
      >
        <div
          className={cn(
            "absolute cursor-pointer transition-transform hover:scale-110",
            isDragging && "opacity-70"
          )}
          style={{
            left: displayLeft + dayWidth / 2 - 10,
            top: top + BAR_HEIGHT / 2 - 10,
          }}
          onMouseDown={(e) => handleMouseDown(e, "move")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <polygon
              points="10,0 20,10 10,20 0,10"
              fill={statusColor}
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </div>
      </ItemContextMenu>
    );
  }

  return (
    <ItemContextMenu
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
      onPriorityChange={onPriorityChange}
      currentStatus={milestone.status}
      currentPriority={milestone.priority}
    >
      <div
        className={cn(
          "absolute rounded-md shadow-sm border overflow-hidden transition-shadow hover:shadow-md",
          isDragging && "opacity-70 shadow-lg"
        )}
        style={{
          left: displayLeft,
          top,
          width: displayWidth,
          height: BAR_HEIGHT,
          backgroundColor: "hsl(var(--card))",
        }}
      >
        {/* Status stripe */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: statusColor }}
        />

        {/* Content */}
        <div
          className="flex items-center h-full pl-3 pr-2 cursor-move"
          onMouseDown={(e) => handleMouseDown(e, "move")}
        >
          <span className="text-sm font-medium truncate flex-1">
            {milestone.title}
          </span>

          {/* Progress */}
          {milestone.progress > 0 && (
            <div className="ml-2 w-12 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${milestone.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Resize handles */}
        <div
          className="absolute left-0 top-0 bottom-0 cursor-ew-resize hover:bg-primary/20"
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onMouseDown={(e) => handleMouseDown(e, "resize-start")}
        />
        <div
          className="absolute right-0 top-0 bottom-0 cursor-ew-resize hover:bg-primary/20"
          style={{ width: RESIZE_HANDLE_WIDTH }}
          onMouseDown={(e) => handleMouseDown(e, "resize-end")}
        />

        {/* Preview tooltip */}
        {isDragging && previewDates && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap shadow-md border">
            {format(previewDates.start, "MMM d")} -{" "}
            {format(previewDates.end, "MMM d")}
          </div>
        )}
      </div>
    </ItemContextMenu>
  );
}
