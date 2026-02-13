"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { format, getYear } from "date-fns";
import { formatDuration } from "@/lib/format-duration";
import { ChevronDown, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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
import { ColorIconPicker } from "./color-icon-picker";

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
}: SectionHeaderProps) {
  const [localColor, setLocalColor] = useState(color);
  const [localIcon, setLocalIcon] = useState(icon);
  const [pickerOpen, setPickerOpen] = useState(false);
  const initialRef = useRef({ color, icon });

  // Sync local state when props change (e.g. after server response)
  useEffect(() => {
    setLocalColor(color);
    setLocalIcon(icon);
    initialRef.current = { color, icon };
  }, [color, icon]);

  const handlePickerOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (!open) {
      // Popover closed — persist if anything changed
      if (localColor !== initialRef.current.color || localIcon !== initialRef.current.icon) {
        onUpdateAppearance?.({ color: localColor, icon: localIcon });
        initialRef.current = { color: localColor, icon: localIcon };
      }
    }
  };

  const dateRangeLabel = useMemo(() => {
    if (!startDate || !endDate) return null;
    const now = new Date();
    const currentYear = getYear(now);
    const startYear = getYear(startDate);
    const endYear = getYear(endDate);

    const startStr = startYear === currentYear
      ? format(startDate, "MMM d")
      : format(startDate, "MMM d, yyyy");
    const endStr = endYear === currentYear
      ? format(endDate, "MMM d")
      : format(endDate, "MMM d, yyyy");

    return `${startStr} – ${endStr}`;
  }, [startDate, endDate]);

  const styles = getColorStyles(localColor);
  const progress =
    featureCount > 0 ? Math.round((completedCount / featureCount) * 100) : 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => { if (!pickerOpen) onToggle(); }}
          className={cn(
            "w-full text-left group relative overflow-hidden px-4 py-3 transition-colors hover:bg-accent/15 cursor-pointer",
            collapsed ? "rounded-2xl" : "rounded-t-2xl",
            isDropTarget && "ring-2 ring-primary/50 bg-primary/5"
          )}
        >
          {/* Gradient background layer — sits behind content, hover overlays on top */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, transparent 30%, ${styles.gradient} 100%)`,
            }}
          />
          <div className="relative flex items-center gap-3">
            {/* Icon in colored circle — click to open color/icon picker */}
            <ColorIconPicker
              color={localColor}
              icon={localIcon}
              onColorChange={setLocalColor}
              onIconChange={setLocalIcon}
              onOpenChange={handlePickerOpenChange}
            >
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: styles.iconBg, color: styles.hex }}
                title="Change icon & color"
              >
                <MilestoneIcon name={localIcon} className="h-4 w-4" />
              </button>
            </ColorIconPicker>

            {/* Name + count */}
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{name}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {completedCount}/{featureCount}
              </span>
              {totalDuration > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {dateRangeLabel ? (
                    <>
                      {dateRangeLabel}{"\u00A0\u00A0"}({formatDuration(totalDuration)})
                    </>
                  ) : (
                    <>{formatDuration(totalDuration)}</>
                  )}
                </span>
              )}
            </div>

            {/* Add feature */}
            {onAddFeature && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddFeature(e);
                }}
                className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent/50 transition-all"
                title="Add feature (Shift+click to chain)"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            {/* More actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent/50 transition-all"
                  title="More actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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

            {/* Chevron */}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                collapsed && "-rotate-90"
              )}
            />
          </div>

          {/* Progress rail at bottom (hidden when collapsed to avoid double-border) */}
          <div className={cn("absolute bottom-0 left-0 right-0 h-0.5 bg-muted/50", collapsed && "hidden")}>
            <div
              className="h-full transition-all duration-300"
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
