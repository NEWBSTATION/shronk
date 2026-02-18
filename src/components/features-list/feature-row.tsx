"use client";

import { useState, useMemo } from "react";
import { format, getYear } from "date-fns";
import { ChevronRight, GripVertical } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";
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

const STATUS_CONFIG: Record<string, { label: string; dotClass: string }> = {
  not_started: { label: "Not Started", dotClass: "bg-zinc-400" },
  in_progress: { label: "In Progress", dotClass: "bg-blue-500" },
  on_hold: { label: "On Hold", dotClass: "bg-amber-500" },
  completed: { label: "Completed", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelled", dotClass: "bg-zinc-400" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG) as [string, { label: string; dotClass: string }][];

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  none: { label: "None", className: "bg-muted/50 text-muted-foreground/70" },
  critical: { label: "Critical", className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  high: { label: "High", className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  medium: { label: "Medium", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  low: { label: "Low", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
};

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
  isDragging,
  isAnyDragging,
  isOverlay,
  dimmed,
  dragHandleProps,
  nodeRef,
  style,
}: FeatureRowProps) {
  const completed = status === "completed";
  const priorityCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;
  const hasTeams = teamDurations && teamDurations.length > 0;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  const [statusOpen, setStatusOpen] = useState(false);

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
      onClick={onClick}
      className={cn(
        "relative flex items-center px-4 py-3.5 transition-[colors,opacity] duration-200 cursor-pointer bg-background border-b last:border-b-0",
        !isAnyDragging && "group hover:bg-accent/50",
        selected && "bg-accent",
        isDragging && "opacity-30",
        dimmed && !isDragging && "opacity-40",
        isOverlay && "border rounded-lg shadow-lg"
      )}
    >
      {/* Drag handle + Checkbox: collapsed by default, expand on hover/select */}
      <div
        className={cn(
          "shrink-0 flex items-center overflow-hidden transition-all duration-150",
          selectMode || selected || statusOpen
            ? "w-10 opacity-100 gap-2 mr-3"
            : isOverlay
              ? "w-10 opacity-100 gap-2 mr-3"
              : "w-0 opacity-0 mr-0 group-hover:w-10 group-hover:opacity-100 group-hover:gap-2 group-hover:mr-3"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center shrink-0",
            selectMode
              ? "text-muted-foreground/20"
              : "cursor-grab active:cursor-grabbing"
          )}
          onClick={(e) => e.stopPropagation()}
          {...(selectMode ? {} : dragHandleProps)}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div
          className="flex items-center justify-center shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
          }}
        >
          <Checkbox checked={selected} className="h-4 w-4" />
        </div>
      </div>

      {/* Completion toggle — 32px wide to align with milestone header icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.();
        }}
        className={cn(
          "shrink-0 h-8 w-8 flex items-center justify-center rounded-full transition-colors",
          completed
            ? "text-green-500 hover:text-green-600"
            : "text-muted-foreground/40 hover:text-muted-foreground/70"
        )}
        title={completed ? "Mark incomplete" : "Mark completed"}
      >
        {completed ? (
          <svg className="h-5 w-5" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
          </svg>
        )}
      </button>

      {/* Feature name + status + team durations + metadata */}
      <div className="flex flex-1 ml-3 min-w-0 gap-3">
        <div className="flex flex-col flex-1 gap-1 min-w-0 justify-center">
          {/* Title line */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm flex-1 truncate text-left",
                completed && "text-muted-foreground line-through"
              )}
            >
              {title}
            </span>
          </div>

          {/* Status + team durations subtitle */}
          <div className="flex items-center gap-1.5 text-[11px] leading-none text-muted-foreground/70">
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="inline-flex items-center rounded-sm px-0.5 -mx-0.5 hover:bg-accent/70 hover:text-foreground transition-colors"
                >
                  {statusCfg.label}
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
                      if (key !== status) {
                        onStatusChange?.(key);
                      }
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
            {hasTeams && (
              <>
                <span className="text-muted-foreground/30">·</span>
                {teamDurations.map((td) => (
                  <span
                    key={td.teamId}
                    className="inline-flex items-center gap-1"
                  >
                    <span
                      className="h-[5px] w-[5px] rounded-full shrink-0"
                      style={{ backgroundColor: td.teamColor }}
                    />
                    <span className="truncate max-w-[72px]">{td.teamName}</span>
                    <span className="tabular-nums text-muted-foreground/50">
                      {formatDuration(td.duration)}
                    </span>
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right side: priority badge + duration badge + chevron */}
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          {priority !== "none" && (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none",
                priorityCfg.className
              )}
            >
              {priorityCfg.label}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums bg-muted text-muted-foreground">
                {duration}d
              </span>
            </TooltipTrigger>
            {dateRangeLabel && (
              <TooltipContent side="top" sideOffset={4}>
                {dateRangeLabel}
              </TooltipContent>
            )}
          </Tooltip>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
}

export function SortableFeatureRow(
  props: Omit<
    FeatureRowProps,
    "isDragging" | "isOverlay" | "dragHandleProps" | "nodeRef" | "style"
  > & { dimmed?: boolean }
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
