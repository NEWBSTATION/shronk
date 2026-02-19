"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { format, getYear } from "date-fns";
import { formatDuration } from "@/lib/format-duration";
import { Check, CheckSquare, ChevronDown, MoreHorizontal, Pencil, Plus, Square, Trash2 } from "lucide-react";
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
  const [localColor, setLocalColor] = useState(color);
  const [localIcon, setLocalIcon] = useState(icon);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const initialRef = useRef({ color, icon });

  useEffect(() => {
    setLocalColor(color);
    setLocalIcon(icon);
    initialRef.current = { color, icon };
  }, [color, icon]);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editing]);

  const commitRename = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onRename?.(trimmed);
    } else {
      setDraft(name);
    }
  }, [draft, name, onRename]);

  const handlePickerOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (!open) {
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
  const allCompleted = featureCount > 0 && completedCount === featureCount;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={() => { if (!pickerOpen) onToggle(); }}
          className={cn(
            "w-full text-left group relative overflow-hidden pl-3 pr-4 py-2.5 cursor-pointer",
            isDropTarget && "ring-2 ring-primary/50",
            !collapsed && "border-b border-border/40"
          )}
          style={{ backgroundColor: `color-mix(in srgb, ${styles.hex} 8%, transparent)` }}
        >
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, transparent 40%, ${styles.gradient} 100%)`,
            }}
          />

          <div className="relative flex items-center gap-2">
            {/* Icon — aligned with row completion circles */}
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
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:opacity-80 transition-opacity"
                style={{ backgroundColor: styles.iconBg, color: styles.hex }}
                title="Change icon & color"
              >
                <MilestoneIcon name={localIcon} className="h-3.5 w-3.5" />
              </button>
            </ColorIconPicker>

            {/* Name — inline editable */}
            {editing ? (
              <input
                ref={nameInputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setDraft(name); setEditing(false); }
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-[13px] font-semibold tracking-tight bg-transparent outline-none ring-1 ring-ring rounded px-1 -mx-1 py-1 min-w-0"
              />
            ) : (
              <span
                className="text-[13px] font-semibold tracking-tight truncate rounded px-1 -mx-1 hover:bg-foreground/[0.06] cursor-text transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(name);
                  setEditing(true);
                }}
              >
                {name}
              </span>
            )}

            {/* Actions — left side, after name */}
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-background/40 transition-all"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
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

              {onAddFeature && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddFeature(e); }}
                  className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-background/40 transition-all"
                  title="Add feature (Shift+click to chain)"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* Right side — counter + date + chevron */}
            <div className="flex items-center gap-1.5">
              {/* Feature count pill */}
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

              {/* Date range + duration chip */}
              {totalDuration > 0 && dateRangeLabel && (
                <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5">
                  <span className="text-[11px] text-foreground/60 tabular-nums">
                    {dateRangeLabel}
                  </span>
                  <span className="h-0.5 w-0.5 rounded-full bg-foreground/25" />
                  <span className="text-[11px] font-medium tabular-nums text-foreground/70">
                    {formatDuration(totalDuration)}
                  </span>
                </span>
              )}

              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                  collapsed && "-rotate-90"
                )}
              />
            </div>
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
