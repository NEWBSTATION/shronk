"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGanttStore } from "@/store/gantt-store";
import {
  StatusBadge,
  PriorityBadge,
  statusConfig,
} from "@/components/shared/status-badge";
import { ItemContextMenu } from "@/components/shared/item-context-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Milestone, Team, MilestoneStatus, MilestonePriority } from "@/db/schema";

interface ListRowProps {
  milestone: Milestone;
  teams: Team[];
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: MilestoneStatus) => void;
  onPriorityChange: (priority: MilestonePriority) => void;
  canReorder: boolean;
  allMilestoneIds: string[];
  className?: string;
}

export function ListRow({
  milestone,
  teams,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  canReorder,
  allMilestoneIds,
  className,
}: ListRowProps) {
  const { selectedIds, toggleItemSelection, selectItem } = useGanttStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: milestone.id,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSelected = selectedIds.includes(milestone.id);
  const team = teams.find((t) => t.id === milestone.teamId);
  const StatusIcon = statusConfig[milestone.status].icon;

  const handleCheckboxChange = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectItem(milestone.id, true, allMilestoneIds);
    } else {
      toggleItemSelection(milestone.id);
    }
  };

  return (
    <ItemContextMenu
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
      onPriorityChange={onPriorityChange}
      currentStatus={milestone.status}
      currentPriority={milestone.priority}
    >
      <TableRow
        ref={setNodeRef}
        style={style}
        className={cn(
          className,
          isSelected && "bg-accent",
          isDragging && "opacity-50 bg-accent"
        )}
      >
        {/* Checkbox */}
        <TableCell>
          <Checkbox
            checked={isSelected}
            onClick={handleCheckboxChange}
            aria-label={`Select ${milestone.title}`}
          />
        </TableCell>

        {/* Drag Handle */}
        {canReorder && (
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TableCell>
        )}

        {/* Status Icon */}
        <TableCell>
          <StatusIcon className="h-4 w-4 text-muted-foreground" />
        </TableCell>

        {/* Title */}
        <TableCell>
          <button
            className="text-left font-medium hover:underline truncate max-w-[300px] block"
            onClick={onEdit}
          >
            {milestone.title}
          </button>
          {milestone.description && (
            <p className="text-sm text-muted-foreground truncate max-w-[300px]">
              {milestone.description}
            </p>
          )}
        </TableCell>

        {/* Priority */}
        <TableCell>
          <PriorityBadge priority={milestone.priority} />
        </TableCell>

        {/* Team */}
        <TableCell>
          {team ? (
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-sm truncate max-w-[80px]">{team.name}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Date Range */}
        <TableCell>
          <span className="text-sm">
            {format(new Date(milestone.startDate), "MMM d")} -{" "}
            {format(new Date(milestone.endDate), "MMM d, yyyy")}
          </span>
        </TableCell>

        {/* Progress */}
        <TableCell>
          <div className="flex items-center gap-2">
            <Progress value={milestone.progress} className="h-2 w-12" />
            <span className="text-xs text-muted-foreground">
              {milestone.progress}%
            </span>
          </div>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    </ItemContextMenu>
  );
}
