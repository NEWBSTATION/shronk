"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { getStatusColor } from "@/components/shared/status-badge";
import { ItemContextMenu } from "@/components/shared/item-context-menu";
import { toLocalMidnight } from "./utils/date-calculations";
import { format, addDays, differenceInDays } from "date-fns";
import { useGanttStore } from "@/store/gantt-store";
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
const BAR_HEIGHT = 36;
const RESIZE_HANDLE_WIDTH = 8;
const CONNECTION_HANDLE_SIZE = 12;

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
  const { showDependencies } = useGanttStore();
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

  // Calculate duration for tooltip
  const duration = previewDates
    ? differenceInDays(previewDates.end, previewDates.start) + 1
    : differenceInDays(
        toLocalMidnight(milestone.endDate),
        toLocalMidnight(milestone.startDate)
      ) + 1;

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
            "absolute cursor-pointer transition-transform hover:scale-110 group",
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

          {/* Label outside */}
          <div
            className="absolute top-1/2 -translate-y-1/2 text-xs font-medium truncate pointer-events-none whitespace-nowrap"
            style={{ left: 28, maxWidth: 200 }}
          >
            {milestone.title}
          </div>

          {/* Connection handles */}
          {showDependencies && (
            <>
              <div
                className="absolute w-3 h-3 rounded-full border-2 bg-background opacity-0 group-hover:opacity-100 cursor-crosshair transition-opacity"
                style={{
                  left: -16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  borderColor: statusColor,
                }}
              />
              <div
                className="absolute w-3 h-3 rounded-full border-2 bg-background opacity-0 group-hover:opacity-100 cursor-crosshair transition-opacity"
                style={{
                  right: -16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  borderColor: statusColor,
                }}
              />
            </>
          )}
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
          "absolute group cursor-pointer",
          isDragging && "z-20"
        )}
        style={{
          left: displayLeft,
          top: top,
          width: displayWidth,
          height: BAR_HEIGHT,
        }}
      >
        {/* Bar background with tinted color */}
        <div
          className={cn(
            "absolute inset-0 rounded-[3px] overflow-hidden transition-shadow hover:shadow-md",
            isDragging && "ring-2 ring-primary shadow-lg"
          )}
          style={{
            backgroundColor: `color-mix(in srgb, ${statusColor} 20%, transparent)`,
          }}
          onMouseDown={(e) => handleMouseDown(e, "move")}
        >
          {/* Left status indicator stripe */}
          <div
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ backgroundColor: statusColor }}
          />

          {/* Left resize handle */}
          <div
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e, "resize-start");
            }}
          >
            <div
              className="w-0.5 h-3 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
          </div>

          {/* Right resize handle */}
          <div
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e, "resize-end");
            }}
          >
            <div
              className="w-0.5 h-3 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
          </div>
        </div>

        {/* Connection handles */}
        {showDependencies && (
          <>
            <div
              className="absolute w-3 h-3 rounded-full border-2 bg-background opacity-0 group-hover:opacity-100 cursor-crosshair transition-opacity"
              style={{
                left: -6,
                top: "50%",
                transform: "translateY(-50%)",
                borderColor: statusColor,
              }}
            />
            <div
              className="absolute w-3 h-3 rounded-full border-2 bg-background opacity-0 group-hover:opacity-100 cursor-crosshair transition-opacity"
              style={{
                right: -6,
                top: "50%",
                transform: "translateY(-50%)",
                borderColor: statusColor,
              }}
            />
          </>
        )}

        {/* Label outside bar to the right */}
        <div
          className="absolute top-1/2 -translate-y-1/2 text-xs font-medium truncate pointer-events-none whitespace-nowrap"
          style={{ left: displayWidth + 8, maxWidth: 200 }}
        >
          {milestone.title}
        </div>

        {/* Hover tooltip */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1.5 bg-popover border rounded-md text-xs opacity-0 group-hover:opacity-100 pointer-events-none shadow-md whitespace-nowrap transition-opacity">
          <span className="font-medium">
            {format(
              previewDates?.start || toLocalMidnight(milestone.startDate),
              "MMM d"
            )}{" "}
            -{" "}
            {format(
              previewDates?.end || toLocalMidnight(milestone.endDate),
              "MMM d"
            )}
          </span>
          <span className="text-muted-foreground ml-1.5">
            ({duration} {duration === 1 ? "day" : "days"})
          </span>
        </div>
      </div>
    </ItemContextMenu>
  );
}
