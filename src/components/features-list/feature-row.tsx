"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { format, getYear } from "date-fns";
import { Check, Users } from "lucide-react";
import { formatDuration, formatDurationIn } from "@/lib/format-duration";
import { DURATION_UNIT_MULTIPLIERS, bestFitDurationUnit } from "@/components/timeline/transformers";
import { useFeaturesListStore, type DurationUnit } from "@/store/features-list-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  cancelled: { label: "Cancelled", dotClass: "bg-red-500" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG) as [string, { label: string; dotClass: string }][];

const PRIORITY_OPTIONS = Object.entries(priorityConfig) as [string, { label: string; icon: React.ElementType; className: string }][];

/** Shared pill button class for right-side metadata actions (28px tall, bordered) */
const PILL = "inline-flex items-center gap-1.5 rounded-full h-7 px-2.5 text-[11px] border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0";

export interface TeamDurationInfo {
  teamId: string;
  teamName: string;
  teamColor: string;
  duration: number;
}

export interface TeamOption {
  id: string;
  name: string;
  color: string;
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
  allTeams?: TeamOption[];
  selected: boolean;
  selectMode: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
  onToggleComplete?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onPriorityChange?: (newPriority: string) => void;
  onRename?: (newTitle: string) => void;
  onDurationChange?: (newDurationDays: number) => void;
  onAddTeamTrack?: (teamId: string) => void;
  onRemoveTeamTrack?: (teamId: string) => void;
  /** Longest formatted duration label across all rows — used to set uniform column width */
  maxDurationLabel?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  isAnyDragging?: boolean;
  dimmed?: boolean;
}

export function FeatureRow({
  id,
  title,
  status,
  priority,
  duration,
  startDate: startDateProp,
  endDate: endDateProp,
  teamDurations,
  allTeams,
  selected,
  selectMode,
  onSelect,
  onClick,
  onToggleComplete,
  onStatusChange,
  onPriorityChange,
  onRename,
  onDurationChange,
  onAddTeamTrack,
  onRemoveTeamTrack,
  maxDurationLabel,
  onContextMenu,
  isDragging,
  isAnyDragging,
  dimmed,
}: FeatureRowProps) {
  const durationUnit = useFeaturesListStore((s) => s.durationUnit);
  const completed = status === "completed";
  const priorityCfg = priorityConfig[priority as keyof typeof priorityConfig] ?? priorityConfig.none;
  const hasPriority = priority !== "none";
  const hasTeams = teamDurations && teamDurations.length > 0;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSearch, setStatusSearch] = useState("");
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [prioritySearch, setPrioritySearch] = useState("");
  const [durationOpen, setDurationOpen] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  const [tracksSearch, setTracksSearch] = useState("");
  const bestFit = useMemo(() => bestFitDurationUnit(duration), [duration]);
  const [localDurValue, setLocalDurValue] = useState(bestFit.value);
  const [localDurUnit, setLocalDurUnit] = useState<DurationUnit>(bestFit.unit);
  const durationInputRef = useRef<HTMLInputElement>(null);

  const computedDays = localDurValue * DURATION_UNIT_MULTIPLIERS[localDurUnit];

  useEffect(() => {
    if (!durationOpen) {
      const fit = bestFitDurationUnit(duration);
      setLocalDurValue(fit.value);
      setLocalDurUnit(fit.unit);
    }
  }, [durationOpen, duration]);

  const handleDurationSubmit = useCallback(() => {
    if (computedDays >= 1 && computedDays !== duration) {
      onDurationChange?.(computedDays);
    }
    setDurationOpen(false);
  }, [computedDays, duration, onDurationChange]);

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
      : format(end, "MMM d, yyyy");

    return `${startStr} – ${endStr}`;
  }, [startDateProp, endDateProp]);

  const PriorityIcon = priorityCfg.icon;

  return (
    <div
      data-feature-id={id}
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
        "relative flex items-center gap-1 px-3 h-11 border-b border-border/40 last:border-b-0 transition-colors duration-100",
        !selectMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        !isAnyDragging && "group hover:bg-muted/40",
        selected && "bg-muted/40",
        isDragging && "opacity-30",
        dimmed && !isDragging && "opacity-40",
      )}
    >
      {/* Checkbox — select mode only */}
      {selectMode && (
        <div
          className="shrink-0 flex items-center justify-center mr-1"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e);
          }}
        >
          <Checkbox checked={selected} className="h-4 w-4" />
        </div>
      )}

      {/* Completion toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onPointerDown={(e) => e.stopPropagation()}
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
          >
            {completed ? (
              <span className="relative h-[18px] w-[18px]">
                <span className="absolute inset-[3px] rounded-full bg-background" />
                <svg className="relative h-[18px] w-[18px]" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z" />
                </svg>
              </span>
            ) : (
              <span className="relative h-[18px] w-[18px]">
                <span className="absolute inset-[3px] rounded-full bg-background" />
                <svg className="relative h-[18px] w-[18px]" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
                </svg>
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {completed ? "Mark Incomplete" : "Mark Complete"}
        </TooltipContent>
      </Tooltip>

      {/* Middle zone — title + inline priority */}
      <div className="flex-1 ml-1 min-w-0 flex items-center gap-1.5">
        <span
          className={cn(
            "text-sm font-medium truncate",
            completed
              ? "text-muted-foreground/60 line-through"
              : "text-foreground"
          )}
        >
          {title}
        </span>

        {/* Priority icon — inline after title, hidden when none */}
        {hasPriority && (
          <ResponsivePopover open={priorityOpen} onOpenChange={(open) => { setPriorityOpen(open); if (!open) setPrioritySearch(""); }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <ResponsivePopoverTrigger asChild>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center h-5 w-5 rounded transition-colors",
                      priority === "high" || priority === "critical"
                        ? "text-orange-500 dark:text-orange-400"
                        : "text-muted-foreground/60 hover:text-muted-foreground"
                    )}
                  >
                    <PriorityIcon className="h-3.5 w-3.5" />
                  </button>
                </ResponsivePopoverTrigger>
              </TooltipTrigger>
              {!priorityOpen && (
                <TooltipContent side="top" sideOffset={4}>
                  {priorityCfg.label}
                </TooltipContent>
              )}
            </Tooltip>
            <ResponsivePopoverContent
              className="w-44 p-0"
              align="start"
              sideOffset={4}
              title="Priority"
              onClick={(e) => e.stopPropagation()}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="px-1.5 pt-1.5 pb-1">
                <input
                  type="text"
                  value={prioritySearch}
                  onChange={(e) => setPrioritySearch(e.target.value)}
                  placeholder="Set priority..."
                  className="w-full h-7 px-2 text-xs rounded-md bg-muted/50 border border-border/40 outline-none placeholder:text-muted-foreground/50 focus:border-ring"
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex flex-col p-1 pt-0">
                {PRIORITY_OPTIONS
                  .filter(([, cfg]) => cfg.label.toLowerCase().includes(prioritySearch.toLowerCase()))
                  .map(([key, cfg]) => {
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
              </div>
            </ResponsivePopoverContent>
          </ResponsivePopover>
        )}

      </div>

      {/* Right zone — pills */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Status pill */}
        <ResponsivePopover open={statusOpen} onOpenChange={(open) => { setStatusOpen(open); if (!open) setStatusSearch(""); }}>
          <ResponsivePopoverTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={cn(PILL, status === "not_started" && "border-dashed")}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusCfg.dotClass)} />
              <span>{statusCfg.label}</span>
            </button>
          </ResponsivePopoverTrigger>
          <ResponsivePopoverContent
            className="w-44 p-0"
            align="start"
            sideOffset={4}
            title="Status"
            onClick={(e) => e.stopPropagation()}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="px-1.5 pt-1.5 pb-1">
              <input
                type="text"
                value={statusSearch}
                onChange={(e) => setStatusSearch(e.target.value)}
                placeholder="Change status..."
                className="w-full h-7 px-2 text-xs rounded-md bg-muted/50 border border-border/40 outline-none placeholder:text-muted-foreground/50 focus:border-ring"
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex flex-col p-1 pt-0">
              {STATUS_OPTIONS
                .filter(([, cfg]) => cfg.label.toLowerCase().includes(statusSearch.toLowerCase()))
                .map(([key, cfg]) => (
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
            </div>
          </ResponsivePopoverContent>
        </ResponsivePopover>

        {/* Tracks pill — checkbox popover to add/remove teams (hidden on small screens) */}
        <ResponsivePopover open={tracksOpen} onOpenChange={(open) => { setTracksOpen(open); if (!open) setTracksSearch(""); }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <ResponsivePopoverTrigger asChild>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    PILL,
                    "hidden sm:inline-flex",
                    !hasTeams && "px-0 w-7 justify-center text-muted-foreground/40 border-dashed"
                  )}
                >
                  <Users className="h-3 w-3" />
                  {hasTeams && (
                    <span className="font-medium tabular-nums">{teamDurations.length}</span>
                  )}
                </button>
              </ResponsivePopoverTrigger>
            </TooltipTrigger>
            {!tracksOpen && (
              <TooltipContent side="top" sideOffset={4}>
                {hasTeams
                  ? teamDurations.length <= 3
                    ? teamDurations.map((td) => td.teamName).join(", ")
                    : `${teamDurations.slice(0, 3).map((td) => td.teamName).join(", ")} +${teamDurations.length - 3} more`
                  : "Add team track"}
              </TooltipContent>
            )}
          </Tooltip>
          <ResponsivePopoverContent
            className="w-52 p-0"
            align="end"
            sideOffset={4}
            title="Team Tracks"
            onClick={(e) => e.stopPropagation()}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {allTeams && allTeams.length > 0 ? (
              <>
                <div className="px-1.5 pt-1.5 pb-1">
                  <input
                    type="text"
                    value={tracksSearch}
                    onChange={(e) => setTracksSearch(e.target.value)}
                    placeholder="Set team tracks..."
                    className="w-full h-7 px-2 text-xs rounded-md bg-muted/50 border border-border/40 outline-none placeholder:text-muted-foreground/50 focus:border-ring"
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex flex-col p-1 pt-0 max-h-48 overflow-y-auto">
                  {allTeams
                    .filter((team) => team.name.toLowerCase().includes(tracksSearch.toLowerCase()))
                    .map((team) => {
                      const isAssigned = teamDurations?.some((td) => td.teamId === team.id) ?? false;
                      return (
                        <button
                          key={team.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAssigned) {
                              onRemoveTeamTrack?.(team.id);
                            } else {
                              onAddTeamTrack?.(team.id);
                            }
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="flex-1 truncate text-left text-foreground">{team.name}</span>
                          {isAssigned && (
                            <Check className="h-3 w-3 shrink-0 text-foreground" />
                          )}
                        </button>
                      );
                    })}
                </div>
              </>
            ) : (
              <p className="px-2 py-3 text-xs text-center text-muted-foreground">
                No teams created yet
              </p>
            )}
          </ResponsivePopoverContent>
        </ResponsivePopover>

        {/* Duration */}
        <ResponsivePopover open={durationOpen} onOpenChange={setDurationOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <ResponsivePopoverTrigger asChild>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-grid items-center justify-items-end shrink-0 h-7 px-1.5 text-[11px] tabular-nums text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                >
                  {maxDurationLabel && (
                    <span className="[grid-area:1/1] invisible whitespace-nowrap">{maxDurationLabel}</span>
                  )}
                  <span className="[grid-area:1/1]">{formatDurationIn(duration, durationUnit)}</span>
                </button>
              </ResponsivePopoverTrigger>
            </TooltipTrigger>
            {dateRangeLabel && !durationOpen && (
              <TooltipContent side="top" sideOffset={4}>
                {dateRangeLabel}
              </TooltipContent>
            )}
          </Tooltip>
          <ResponsivePopoverContent
            className="w-56 p-3"
            align="end"
            side="bottom"
            sideOffset={4}
            title="Duration"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              setTimeout(() => durationInputRef.current?.select(), 0);
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">Duration</p>
            <div className="flex items-center gap-2">
              <Input
                ref={durationInputRef}
                type="number"
                min={1}
                value={localDurValue}
                onChange={(e) => setLocalDurValue(Math.max(1, parseInt(e.target.value) || 1))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDurationSubmit();
                  if (e.key === "Escape") setDurationOpen(false);
                }}
                className="h-8 w-18 flex-1 min-w-0 text-sm tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Select
                value={localDurUnit}
                onValueChange={(v) => setLocalDurUnit(v as DurationUnit)}
              >
                <SelectTrigger className="h-8 flex-[2] min-w-0 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">days</SelectItem>
                  <SelectItem value="weeks">weeks</SelectItem>
                  <SelectItem value="months">months</SelectItem>
                  <SelectItem value="years">years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {computedDays !== duration && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{computedDays}d total</span>
                <button
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={handleDurationSubmit}
                >
                  Apply
                </button>
              </div>
            )}
          </ResponsivePopoverContent>
        </ResponsivePopover>
      </div>

    </div>
  );
}

