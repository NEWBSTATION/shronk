"use client";

import { Check, CheckSquare, MoreHorizontal, Pencil, Plus, Square, Trash2 } from "lucide-react";
import { MilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SectionHeaderProps {
  milestoneId: string;
  name: string;
  color: string;
  icon: string;
  featureCount: number;
  completedCount: number;
  totalDuration: number;
  startDate?: Date;
  endDate?: Date;
  collapsed: boolean;
  isDropTarget?: boolean;
  onToggle: () => void;
  onAddFeature?: (e: React.MouseEvent) => void;
  onEditMilestone?: () => void;
  onDeleteMilestone?: () => void;
  onUpdateAppearance?: (data: { color: string; icon: string }) => void;
  onRename?: (newName: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  hasSelectedFeatures?: boolean;
}

export function SectionHeader({
  name,
  color,
  icon,
  featureCount,
  completedCount,
  totalDuration,
  startDate,
  endDate,
  collapsed,
  isDropTarget,
  onToggle,
  onAddFeature,
  onEditMilestone,
  onDeleteMilestone,
  onUpdateAppearance,
  onRename,
  onSelectAll,
  onDeselectAll,
  hasSelectedFeatures,
}: SectionHeaderProps) {

  const styles = getColorStyles(color);
  const progress =
    featureCount > 0 ? Math.round((completedCount / featureCount) * 100) : 0;
  const allCompleted = featureCount > 0 && completedCount === featureCount;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={onToggle}
          className={cn(
            "w-full text-left group relative overflow-hidden px-3 py-2.5 cursor-pointer",
            isDropTarget && "ring-2 ring-primary/50",
            !collapsed && "border-b border-border/40"
          )}
          style={{ backgroundColor: `color-mix(in srgb, ${styles.hex} 8%, transparent)` }}
        >
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100"
            style={{
              background: `linear-gradient(to right, transparent 40%, ${styles.gradient} 100%)`,
            }}
          />

          <div className="relative flex items-center gap-1.5">
            {/* Icon — h-6 w-6 to align with feature row check circle */}
            <div
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded"
              style={{ backgroundColor: styles.iconBg, color: styles.hex, borderRadius: 5 }}
            >
              <MilestoneIcon name={icon} className="h-3.5 w-3.5" />
            </div>

            {/* Name */}
            <span className="text-[13px] font-medium tracking-tight truncate text-foreground/80">
              {name}
            </span>

            {/* Feature count pill — next to name */}
            {allCompleted ? (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5">
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Completed
                </span>
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center rounded-full bg-foreground/[0.06] px-2 py-0.5">
                <span className="text-[11px] font-medium tabular-nums text-foreground/70">
                  {completedCount}/{featureCount}
                </span>
              </span>
            )}

            {/* More menu — hover only on desktop */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-foreground/60 md:opacity-0 md:group-hover:opacity-100 hover:text-foreground hover:bg-background/40 transition-all"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start">
                {onEditMilestone && (
                  <DropdownMenuItem onClick={onEditMilestone}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit milestone
                  </DropdownMenuItem>
                )}
                {onAddFeature && (
                  <DropdownMenuItem onClick={onAddFeature}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add feature
                  </DropdownMenuItem>
                )}
                {onSelectAll && (
                  <DropdownMenuItem onClick={onSelectAll}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select all features
                  </DropdownMenuItem>
                )}
                {hasSelectedFeatures && onDeselectAll && (
                  <DropdownMenuItem onClick={onDeselectAll}>
                    <Square className="h-4 w-4 mr-2" />
                    Deselect all features
                  </DropdownMenuItem>
                )}
                {onDeleteMilestone && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDeleteMilestone}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete milestone
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Add feature — always visible, far right */}
            {onAddFeature && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddFeature(e); }}
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-background/40 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <span className="flex items-center gap-1.5">Add feature <kbd className="text-[11px] font-mono text-background/70 bg-background/20 px-1 py-0.5 rounded-[2px]">F</kbd></span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Progress rail */}
          <div className={cn("absolute bottom-0 left-0 right-0 h-[2px]", collapsed && "hidden")}>
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{ width: `${progress}%`, backgroundColor: styles.hex }}
            />
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {onEditMilestone && (
          <ContextMenuItem onClick={onEditMilestone}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit milestone
          </ContextMenuItem>
        )}
        {onAddFeature && (
          <ContextMenuItem onClick={onAddFeature}>
            <Plus className="h-4 w-4 mr-2" />
            Add feature
          </ContextMenuItem>
        )}
        {onSelectAll && (
          <ContextMenuItem onClick={onSelectAll}>
            <CheckSquare className="h-4 w-4 mr-2" />
            Select all features
          </ContextMenuItem>
        )}
        {hasSelectedFeatures && onDeselectAll && (
          <ContextMenuItem onClick={onDeselectAll}>
            <Square className="h-4 w-4 mr-2" />
            Deselect all features
          </ContextMenuItem>
        )}
        {onDeleteMilestone && (
          <ContextMenuItem
            onClick={onDeleteMilestone}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete milestone
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
