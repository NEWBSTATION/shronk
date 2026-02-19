"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { statusConfig, priorityConfig } from "./status-badge";
import type { MilestoneStatus, MilestonePriority } from "@/db/schema";
import { Pencil, Trash2, CheckCircle, Flag } from "lucide-react";

interface ItemContextMenuProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: MilestoneStatus) => void;
  onPriorityChange: (priority: MilestonePriority) => void;
  currentStatus: MilestoneStatus;
  currentPriority: MilestonePriority;
}

export function ItemContextMenu({
  children,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  currentStatus,
  currentPriority,
}: ItemContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CheckCircle className="mr-2 h-4 w-4" />
            Change Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {Object.entries(statusConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <ContextMenuItem
                  key={key}
                  onClick={() => onStatusChange(key as MilestoneStatus)}
                  className={currentStatus === key ? "bg-accent text-accent-foreground" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {config.label}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" />
            Change Priority
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {Object.entries(priorityConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <ContextMenuItem
                  key={key}
                  onClick={() => onPriorityChange(key as MilestonePriority)}
                  className={currentPriority === key ? "bg-accent text-accent-foreground" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {config.label}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
