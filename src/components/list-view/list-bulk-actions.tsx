"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { statusConfig, priorityConfig } from "@/components/shared/status-badge";
import type { MilestoneStatus, MilestonePriority } from "@/db/schema";
import { X, ChevronDown, CheckCircle, Flag, Trash2 } from "lucide-react";

interface ListBulkActionsProps {
  selectedCount: number;
  onStatusChange: (status: MilestoneStatus) => void;
  onPriorityChange: (priority: MilestonePriority) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function ListBulkActions({
  selectedCount,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onClearSelection,
}: ListBulkActionsProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-background border rounded-lg shadow-lg px-4 py-2">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="w-px h-6 bg-border mx-2" />

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Status
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.entries(statusConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onStatusChange(key as MilestoneStatus)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {config.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Flag className="h-4 w-4" />
              Priority
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.entries(priorityConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onPriorityChange(key as MilestonePriority)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {config.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border mx-2" />

        {/* Delete */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>

        {/* Clear Selection */}
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
