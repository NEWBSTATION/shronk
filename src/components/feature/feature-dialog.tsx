"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { CalendarIcon, Timer, Layers3, Users, Trash2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PropertyRow } from "@/components/ui/property-row";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { priorityConfig, PriorityHighIcon } from "@/components/shared/status-badge";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";
import {
  computeEndDateFromDuration,
  DURATION_UNIT_MULTIPLIERS,
  type DurationUnit,
} from "@/components/timeline/transformers";
import type { MilestoneStatus, MilestonePriority } from "@/db/schema";

interface MilestoneOption {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface TeamOption {
  id: string;
  name: string;
  color: string;
  autoAdd?: boolean;
}

export interface ChainTo {
  featureId: string;
  featureTitle: string;
  endDate: Date | string;
}

interface FeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: MilestoneOption[];
  /** Pre-select a milestone when opening */
  defaultMilestoneId?: string | null;
  /** Available teams for team track assignment */
  teams?: TeamOption[];
  /** Previous feature to chain to (sets start date + creates dependency) */
  chainTo?: ChainTo | null;
  /** Whether chain toggle should start enabled */
  chainEnabled?: boolean;
  /** Called when toast "Open" is clicked — receives created feature ID */
  onOpenFeature?: (id: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Status / Priority display helpers (match drilldown panel)                  */
/* -------------------------------------------------------------------------- */

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; dotClass: string }> = {
  not_started: { label: "Not Started", dotClass: "bg-zinc-400" },
  in_progress: { label: "In Progress", dotClass: "bg-blue-500" },
  on_hold: { label: "On Hold", dotClass: "bg-amber-500" },
  completed: { label: "Completed", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-500" },
};

function StatusDisplay({ status }: { status: MilestoneStatus }) {
  const { label, dotClass } = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} />
      <span>{label}</span>
    </div>
  );
}

function PriorityDisplay({ priority }: { priority: MilestonePriority }) {
  const cfg = priorityConfig[priority];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{cfg.label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Feature Dialog                                                              */
/* -------------------------------------------------------------------------- */

export function FeatureDialog({
  open,
  onOpenChange,
  milestones,
  defaultMilestoneId,
  teams = [],
  chainTo: chainToProp,
  chainEnabled: chainEnabledProp = false,
  onOpenFeature,
}: FeatureDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [durationValue, setDurationValue] = useState(2);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("weeks");
  const [durationOpen, setDurationOpen] = useState(false);
  const [localDurationValue, setLocalDurationValue] = useState(2);
  const [localDurationUnit, setLocalDurationUnit] = useState<DurationUnit>("weeks");
  const [pendingTeamTracks, setPendingTeamTracks] = useState<Map<string, number>>(new Map());
  const [chainActive, setChainActive] = useState(false);
  const [status, setStatus] = useState<MilestoneStatus>("not_started");
  const [priority, setPriority] = useState<MilestonePriority>("none");
  const [description, setDescription] = useState("");

  // Derive chainTo: use explicit prop if provided, otherwise compute from selected milestone
  const chainTo = useMemo(() => {
    if (chainToProp) return chainToProp;
    if (!milestoneId) return null;
    const cached = queryClient.getQueryData<{ features: { id: string; title: string; endDate: Date | string; projectId: string }[] }>(["allFeatures"]);
    if (!cached?.features) return null;
    const milestoneFeatures = cached.features.filter((f) => f.projectId === milestoneId);
    const last = milestoneFeatures.length > 0 ? milestoneFeatures[milestoneFeatures.length - 1] : null;
    if (!last) return null;
    return { featureId: last.id, featureTitle: last.title, endDate: last.endDate };
  }, [chainToProp, milestoneId, queryClient]);

  // Sync default milestone + chain state when dialog opens
  useEffect(() => {
    if (open) {
      setMilestoneId(defaultMilestoneId || milestones[0]?.id || "");
      const shouldChain = chainEnabledProp && !!chainToProp;
      setChainActive(shouldChain);
      if (shouldChain && chainToProp) {
        setStartDate(addDays(new Date(chainToProp.endDate), 1));
      }
      // Pre-populate team tracks from teams with autoAdd enabled
      const autoAddTeams = teams.filter((t) => t.autoAdd);
      if (autoAddTeams.length > 0) {
        const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
        setPendingTeamTracks(
          new Map(autoAddTeams.map((t) => [t.id, totalDays]))
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMilestoneId, milestones, chainEnabledProp, chainToProp, teams]);

  // When chain toggle is turned on, snap start date to predecessor's end + 1
  const handleChainToggle = (checked: boolean) => {
    setChainActive(checked);
    if (checked && chainTo) {
      setStartDate(addDays(new Date(chainTo.endDate), 1));
    }
  };

  const resetForm = () => {
    setTitle("");
    setMilestoneId(defaultMilestoneId || milestones[0]?.id || "");
    setStartDate(new Date());
    setDurationValue(2);
    setDurationUnit("weeks");
    setPendingTeamTracks(new Map());
    setChainActive(false);
    setStatus("not_started");
    setPriority("none");
    setDescription("");
    setError(null);
  };

  const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
  const endDate = computeEndDateFromDuration(startDate, totalDays);

  const handleSubmit = async () => {
    if (!title.trim() || !milestoneId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: milestoneId,
          title: title.trim(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          duration: totalDays,
          status,
          priority,
          ...(description.trim() ? { description: description.trim() } : {}),
        }),
      });

      if (!response.ok) throw new Error("Failed to create feature");

      const newMilestone = await response.json();

      // Create chain dependency if active
      if (chainActive && chainTo) {
        await fetch("/api/dependencies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            predecessorId: chainTo.featureId,
            successorId: newMilestone.id,
          }),
        });
      }

      // Upsert pending team tracks
      if (pendingTeamTracks.size > 0) {
        await Promise.all(
          Array.from(pendingTeamTracks).map(([teamId, duration]) =>
            fetch("/api/team-durations", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                milestoneId: newMilestone.id,
                teamId,
                duration,
              }),
            })
          )
        );
      }

      const featureId = newMilestone.id;
      const featureName = title.trim();
      toast.success(chainActive && chainTo ? "Feature created & chained" : "Feature created", {
        description: featureName,
        ...(onOpenFeature ? { action: { label: "Open", onClick: () => onOpenFeature(featureId) } } : {}),
      });
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      if (chainActive && chainTo) {
        queryClient.invalidateQueries({ queryKey: ["dependencies"] });
      }
    } catch (err) {
      setError((err as Error).message || "Failed to create feature");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogContent
        className="sm:max-w-[500px] gap-0"
        showCloseButton={false}
        onPointerDownOutside={(e) => {
          if ((e.target as HTMLElement).closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          if ((e.target as HTMLElement)?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogTitle className="sr-only">New Feature</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new feature within a milestone.
        </DialogDescription>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Feature name..."
            className="w-full text-2xl sm:text-3xl font-bold leading-normal bg-transparent border-none outline-none placeholder:text-ring rounded-md px-2 pt-0.5 pb-1 -ml-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors"
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim() && milestoneId) {
                handleSubmit();
              }
            }}
          />
        </div>

        <div className="space-y-0.5">
          {/* Status */}
          <PropertyRow icon={CircleDot} label="Status" type="custom">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as MilestoneStatus)}
            >
              <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent focus:ring-0 w-auto gap-2 bg-transparent dark:bg-transparent [&>svg:last-child]:hidden">
                <SelectValue>
                  <StatusDisplay status={status} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">
                  <StatusDisplay status="not_started" />
                </SelectItem>
                <SelectItem value="in_progress">
                  <StatusDisplay status="in_progress" />
                </SelectItem>
                <SelectItem value="on_hold">
                  <StatusDisplay status="on_hold" />
                </SelectItem>
                <SelectItem value="completed">
                  <StatusDisplay status="completed" />
                </SelectItem>
                <SelectItem value="cancelled">
                  <StatusDisplay status="cancelled" />
                </SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>

          {/* Milestone */}
          <PropertyRow icon={Layers3} label="Milestone" type="custom">
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent/50 focus:ring-0 bg-transparent dark:bg-transparent dark:hover:bg-accent/50 [&>svg:last-child]:hidden">
                <SelectValue placeholder="Select milestone" />
              </SelectTrigger>
              <SelectContent>
                {milestones.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyRow>

          {/* Priority */}
          <PropertyRow icon={PriorityHighIcon} label="Priority" type="custom">
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as MilestonePriority)}
            >
              <SelectTrigger className={cn("border-0 shadow-none h-8 px-2 text-sm hover:bg-accent/50 focus:ring-0 w-auto gap-2 bg-transparent dark:bg-transparent dark:hover:bg-accent/50 [&>svg:last-child]:hidden", priority === "none" && "text-muted-foreground/60")}>
                <SelectValue>
                  {priority === "none" ? (
                    <span>No Priority</span>
                  ) : (
                    <PriorityDisplay priority={priority} />
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.keys(priorityConfig).map((key) => (
                  <SelectItem key={key} value={key}>
                    <PriorityDisplay priority={key as MilestonePriority} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyRow>

          {/* Duration */}
          <PropertyRow icon={Timer} label="Duration" type="custom">
            <Popover
              open={durationOpen}
              onOpenChange={(newOpen) => {
                if (newOpen) {
                  setLocalDurationValue(durationValue);
                  setLocalDurationUnit(durationUnit);
                }
                if (!newOpen && (localDurationValue !== durationValue || localDurationUnit !== durationUnit)) {
                  setDurationValue(Math.max(0, localDurationValue));
                  setDurationUnit(localDurationUnit);
                }
                setDurationOpen(newOpen);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  {durationValue}{" "}
                  {durationValue === 1 ? durationUnit.slice(0, -1) : durationUnit}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="flex items-center gap-2">
                  <NumberStepper
                    value={localDurationValue}
                    onChange={(v) => setLocalDurationValue(Math.max(0, v))}
                    min={0}
                    className="w-20"
                  />
                  <Select
                    value={localDurationUnit}
                    onValueChange={(v) => setLocalDurationUnit(v as DurationUnit)}
                  >
                    <SelectTrigger className="h-9 w-[100px] dark:bg-input/50">
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
              </PopoverContent>
            </Popover>
          </PropertyRow>

          {/* Start date */}
          <PropertyRow icon={CalendarIcon} label="Start date" type="custom">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={chainActive}
                  className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {format(startDate, "MMM d, yyyy")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  fromDate={TIMELINE_START_DATE}
                  toDate={TIMELINE_END_DATE}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </PropertyRow>

          {/* Team Tracks — PropertyRow + Popover (matches drilldown) */}
          {teams.length > 0 && (
            <DialogTeamTracksRow
              teams={teams}
              pendingTracks={pendingTeamTracks}
              defaultDuration={totalDays}
              onAdd={(teamId, duration) => {
                setPendingTeamTracks((prev) => new Map(prev).set(teamId, duration));
              }}
              onUpdateDuration={(teamId, duration) => {
                setPendingTeamTracks((prev) => new Map(prev).set(teamId, duration));
              }}
              onRemove={(teamId) => {
                setPendingTeamTracks((prev) => {
                  const next = new Map(prev);
                  next.delete(teamId);
                  return next;
                });
              }}
            />
          )}
        </div>

        {/* Description */}
        <div className="mt-4 pt-4 border-t border-border">
          <RichTextEditor
            content={description}
            onChange={setDescription}
            saveStatus="idle"
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          {chainTo && (
            <label className="flex items-center gap-2 cursor-pointer select-none sm:mr-auto">
              <Switch
                size="sm"
                checked={chainActive}
                onCheckedChange={handleChainToggle}
              />
              <span className="text-xs text-muted-foreground">Auto-Chain</span>
            </label>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !milestoneId || isLoading}
            >
              {isLoading ? "Creating..." : "Create Feature"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialog Team Tracks — PropertyRow + Popover (matches drilldown pattern)     */
/* -------------------------------------------------------------------------- */

function DialogTeamTracksRow({
  teams,
  pendingTracks,
  defaultDuration,
  onAdd,
  onUpdateDuration,
  onRemove,
}: {
  teams: TeamOption[];
  pendingTracks: Map<string, number>;
  defaultDuration: number;
  onAdd: (teamId: string, duration: number) => void;
  onUpdateDuration: (teamId: string, duration: number) => void;
  onRemove: (teamId: string) => void;
}) {
  const assignedTeamIds = new Set(pendingTracks.keys());
  const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t.id));
  const assignedTeams = Array.from(pendingTracks.keys())
    .map((id) => teams.find((t) => t.id === id))
    .filter(Boolean) as TeamOption[];

  return (
    <PropertyRow icon={Users} label="Teams" type="custom">
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer gap-1.5 min-w-0"
              >
                {assignedTeams.length > 0 ? (
                  <span className="truncate">
                    {assignedTeams.length === 1
                      ? assignedTeams[0].name
                      : `${assignedTeams.length} teams`}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">Add teams...</span>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          {assignedTeams.length > 1 && (
            <TooltipContent side="bottom" align="start" className="p-0 bg-foreground">
              <div className="flex flex-col gap-0.5 py-1.5 px-2">
                {Array.from(pendingTracks).map(([teamId, duration]) => {
                  const team = assignedTeams.find((t) => t.id === teamId);
                  if (!team) return null;
                  return (
                    <div key={teamId} className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-xs">{team.name}</span>
                      <span className="text-xs text-background/50 ml-auto pl-3">
                        {duration}d
                      </span>
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 space-y-0.5">
            {Array.from(pendingTracks).map(([teamId, duration]) => {
              const team = teams.find((t) => t.id === teamId);
              if (!team) return null;
              return (
                <DialogTeamTrackRow
                  key={teamId}
                  team={team}
                  duration={duration}
                  onUpdateDuration={(d) => onUpdateDuration(teamId, d)}
                  onRemove={() => onRemove(teamId)}
                />
              );
            })}
            {unassignedTeams.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 min-h-7 py-0.5 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    + Add team
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  {unassignedTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => onAdd(team.id, defaultDuration)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </PropertyRow>
  );
}

function DialogTeamTrackRow({
  team,
  duration,
  onUpdateDuration,
  onRemove,
}: {
  team: TeamOption;
  duration: number;
  onUpdateDuration: (duration: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [localDuration, setLocalDuration] = useState(duration);

  useEffect(() => {
    if (open) setLocalDuration(duration);
  }, [open, duration]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && localDuration !== duration) {
        onUpdateDuration(Math.max(0, localDuration));
      }
      setOpen(newOpen);
    },
    [localDuration, duration, onUpdateDuration]
  );

  return (
    <div className="flex items-center gap-2 px-1.5 py-1.5 -mx-0.5 rounded-lg hover:bg-accent/30 group">
      <div
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: team.color }}
      />
      <span className="text-sm font-medium truncate min-w-0 flex-1">{team.name}</span>

      <Popover open={open} onOpenChange={handleClose}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-xs font-medium tabular-nums text-muted-foreground bg-accent/60 px-2 py-1 rounded-md hover:bg-accent transition-colors shrink-0 cursor-pointer"
          >
            {duration}d
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <p className="text-xs text-muted-foreground mb-2">Duration</p>
          <div className="flex items-center gap-2">
            <NumberStepper
              value={localDuration}
              onChange={(v) => setLocalDuration(Math.max(0, v))}
              min={0}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">
              {localDuration === 1 ? "day" : "days"}
            </span>
          </div>
        </PopoverContent>
      </Popover>

      <button
        onClick={onRemove}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
        title="Remove team track"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
