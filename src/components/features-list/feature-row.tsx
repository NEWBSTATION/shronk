"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format, getYear } from "date-fns";
import { ChevronRight, GripVertical } from "lucide-react";
import { formatDuration, formatDurationIn } from "@/lib/format-duration";
import type { DurationUnit } from "@/store/features-list-store";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { priorityConfig } from "@/components/shared/status-badge";

const STATUS_CONFIG: Record<string, { label: string; dotClass: string }> = {
  not_started: { label: "Not Started", dotClass: "bg-zinc-400" },
  in_progress: { label: "In Progress", dotClass: "bg-blue-500" },
  on_hold: { label: "On Hold", dotClass: "bg-amber-500" },
  completed: { label: "Completed", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelled", dotClass: "bg-zinc-400" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG) as [string, { label: string; dotClass: string }][];

const PRIORITY_OPTIONS = Object.entries(priorityConfig) as [string, { label: string; icon: React.ElementType; className: string }][];

/** Grid column template shared between header and rows */
export const TABLE_GRID_COLS = "1fr 100px 72px 56px";

export interface TeamDurationInfo {
  teamId: string;
  teamName: string;
  teamColor: string;
  duration: number;
}

interface FeatureRowProps {
  id: string;
  title: string;
  status: string;
  priority: string;
  duration: number;
  startDate?: Date | string;
  endDate?: Date | string;
  teamDurations?: TeamDurationInfo[];
  selected: boolean;
  selectMode: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
  onToggleComplete?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onPriorityChange?: (newPriority: string) => void;
  onRename?: (newTitle: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  durationUnit?: DurationUnit;
  isDragging?: boolean;
  isAnyDragging?: boolean;
  isOverlay?: boolean;
  dimmed?: boolean;
  dragHandleProps?: Record<string, unknown>;
  nodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

export function FeatureRow({
  title,
  status,
  priority,
  duration,
  startDate: startDateProp,
  endDate: endDateProp,
  teamDurations,
  selected,
  selectMode,
  onSelect,
  onClick,
  onToggleComplete,
  onStatusChange,
  onPriorityChange,
  onRename,
  onContextMenu,
  durationUnit = "days",
  isDragging,
  isAnyDragging,
  isOverlay,
  dimmed,
  dragHandleProps,
  nodeRef,
  style,
}: FeatureRowProps) {
  const completed = status === "completed";
  const priorityCfg = priorityConfig[priority as keyof typeof priorityConfig] ?? priorityConfig.none;
  const hasTeams = teamDurations && teamDurations.length > 0;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleDraft(title); }, [title]);
  useEffect(() => {
    if (titleEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [titleEditing]);

  const commitTitle = useCallback(() => {
    setTitleEditing(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== title) {
      onRename?.(trimmed);
    } else {
      setTitleDraft(title);
    }
  }, [titleDraft, title, onRename]);

  const dateRangeLabel = useMemo(() => {
    if (!startDateProp || !endDateProp) return null;
    const start = new Date(startDateProp);
    const end = new Date(endDateProp);
    const now = new Date();
    const currentYear = getYear(now);
    const startYear = getYear(start);
    const endYear = getYear(end);

    const startStr = startYear === currentYear
      ? format(start, "MMM d")
      : format(start, "MMM d, yyyy");
    const endStr = endYear === currentYear
      ? format(end, "MMM d")
      : String(endYear);

    return `${startStr} – ${endStr}`;
  }, [startDateProp, endDateProp]);

  return (
    <div
      ref={nodeRef}
      style={style}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e);
        }
      }}
      onClick={(e) => {
        if (e.shiftKey || selectMode) {
          e.preventDefault();
          onSelect(e);
          return;
        }
        onClick();
      }}
      className={cn(
        "relative flex items-center px-3 py-3 border-b border-border/40 last:border-b-0 transition-colors duration-100 cursor-pointer",
        !isAnyDragging && "group hover:bg-muted/40",
        selected && "bg-muted/40",
        isDragging && "opacity-30",
        dimmed && !isDragging && "opacity-40",
        isOverlay && "bg-background border rounded-lg shadow-lg"
      )}
    >
      {/* Drag handle — absolute overlay on left edge, hover only */}
      {!selectMode && (
        <div
          className={cn(
            "absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity",
            !isAnyDragging && "group-hover:opacity-100",
            isOverlay && "opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
        </div>
      )}

      {/* Checkbox — select mode only */}
      {selectMode && (
        <div
          className="shrink-0 flex items-center justify-center mr-2"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
          }}
        >
          <Checkbox checked={selected} className="h-4 w-4" />
        </div>
      )}

      {/* Completion toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.();
        }}
        className={cn(
          "shrink-0 h-7 w-7 flex items-center justify-center rounded-full transition-colors",
          completed
            ? "text-green-500 hover:text-green-600"
            : "text-muted-foreground/40 hover:text-muted-foreground/70"
        )}
        title={completed ? "Mark incomplete" : "Mark completed"}
      >
        {completed ? (
          <svg className="h-[18px] w-[18px]" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z" />
          </svg>
        ) : (
          <svg className="h-[18px] w-[18px]" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
          </svg>
        )}
      </button>

      {/* Content area — responsive grid */}
      <div
        className="flex-1 ml-2 min-w-0 grid grid-cols-1 md:grid-cols-[var(--table-cols)] items-center gap-x-3"
        style={{ "--table-cols": TABLE_GRID_COLS } as React.CSSProperties}
      >
        {/* Col 1: Title + inline team dots */}
        <div className="min-w-0 flex items-center gap-2">
          {titleEditing ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") { setTitleDraft(title); setTitleEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium bg-transparent outline-none ring-1 ring-ring rounded px-1 -mx-1 py-1 min-w-0"
            />
          ) : (
            <span
              className={cn(
                "text-sm font-medium truncate rounded px-1 -mx-1 hover:bg-foreground/[0.06] cursor-text transition-colors",
                completed
                  ? "text-muted-foreground/60 line-through"
                  : "text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setTitleDraft(title);
                setTitleEditing(true);
              }}
            >
              {title}
            </span>
          )}

          {/* Team dots — inline, condensed */}
          {hasTeams && (
            <div className="hidden md:flex items-center gap-0.5 shrink-0">
              {teamDurations.map((td) => (
                <Tooltip key={td.teamId}>
                  <TooltipTrigger asChild>
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: td.teamColor }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4}>
                    {td.teamName} ({formatDuration(td.duration)})
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Mobile-only: inline metadata */}
          <div className="flex md:hidden items-center gap-1.5 text-[11px] leading-none text-muted-foreground shrink-0">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusCfg.dotClass)} />
            <span>{statusCfg.label}</span>
            <span className="text-muted-foreground/30">&middot;</span>
            <span className="tabular-nums">{formatDurationIn(duration, durationUnit)}</span>
          </div>
        </div>

        {/* Col 2: Status — desktop only */}
        <div className="hidden md:flex items-center">
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-md min-h-[28px] px-2 py-0.5 text-xs text-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors -ml-2"
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", statusCfg.dotClass)} />
                <span>{statusCfg.label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-36 p-1"
              align="start"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusOpen(false);
                    if (key !== status) onStatusChange?.(key);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    key === status
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dotClass)} />
                  {cfg.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* Col 3: Priority — desktop only */}
        <div className="hidden md:flex items-center">
          <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "inline-flex items-center justify-center rounded-md min-h-[28px] min-w-[28px] px-1.5 py-0.5 transition-colors -ml-1",
                  priority !== "none"
                    ? priorityCfg.className
                    : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60"
                )}
              >
                {(() => { const Icon = priorityCfg.icon; return <Icon className="h-3.5 w-3.5" />; })()}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-36 p-1"
              align="start"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
            >
              {PRIORITY_OPTIONS.map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPriorityOpen(false);
                      if (key !== priority) onPriorityChange?.(key);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                      key === priority
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {cfg.label}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        {/* Col 4: Duration — desktop only */}
        <div className="hidden md:flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs tabular-nums text-foreground/50">
                {formatDurationIn(duration, durationUnit)}
              </span>
            </TooltipTrigger>
            {dateRangeLabel && (
              <TooltipContent side="top" sideOffset={4}>
                {dateRangeLabel}
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {/* Chevron — desktop only */}
      <ChevronRight className="hidden md:block h-3.5 w-3.5 text-muted-foreground/40 ml-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function SortableFeatureRow(
  props: Omit<
    FeatureRowProps,
    "isDragging" | "isOverlay" | "dragHandleProps" | "nodeRef" | "style"
  > & { dimmed?: boolean; onContextMenu?: (e: React.MouseEvent) => void }
) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <FeatureRow
      {...props}
      nodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandleProps={
        props.selectMode ? undefined : { ...attributes, ...listeners }
      }
    />
  );
}
