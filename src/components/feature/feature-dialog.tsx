"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Timer, Layers3, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";
import {
  computeEndDateFromDuration,
  DURATION_UNIT_MULTIPLIERS,
  type DurationUnit,
} from "@/components/timeline/transformers";

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
}

interface FeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: MilestoneOption[];
  /** Pre-select a milestone when opening */
  defaultMilestoneId?: string | null;
  /** Available teams for team track assignment */
  teams?: TeamOption[];
}

export function FeatureDialog({
  open,
  onOpenChange,
  milestones,
  defaultMilestoneId,
  teams = [],
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

  // Sync default milestone when dialog opens
  useEffect(() => {
    if (open) {
      setMilestoneId(defaultMilestoneId || milestones[0]?.id || "");
    }
  }, [open, defaultMilestoneId, milestones]);

  const resetForm = () => {
    setTitle("");
    setMilestoneId(defaultMilestoneId || milestones[0]?.id || "");
    setStartDate(new Date());
    setDurationValue(2);
    setDurationUnit("weeks");
    setPendingTeamTracks(new Map());
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
          status: "not_started",
        }),
      });

      if (!response.ok) throw new Error("Failed to create feature");

      const newMilestone = await response.json();

      // Upsert pending team tracks
      if (pendingTeamTracks.size > 0) {
        await Promise.all(
          Array.from(pendingTeamTracks).map(([teamId, duration]) =>
            fetch("/api/team-durations", {
              method: "POST",
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

      toast.success("Feature created");
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
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
            className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
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
          {/* Milestone */}
          <PropertyRow icon={Layers3} label="Milestone" type="custom">
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent focus:ring-0">
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
                  setDurationValue(Math.max(1, localDurationValue));
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
                    onChange={(v) => setLocalDurationValue(Math.max(1, v))}
                    min={1}
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
                  className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
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
        </div>

        {/* Team Tracks */}
        {teams.length > 0 && (
          <DialogTeamTracksSection
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

        <DialogFooter className="mt-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialog Team Tracks (local state for create mode)                           */
/* -------------------------------------------------------------------------- */

function DialogTeamTracksSection({
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

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-3 mb-2 px-2 -mx-2">
        <Users className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Team Tracks</span>
      </div>

      {pendingTracks.size === 0 && (
        <p className="text-xs text-muted-foreground/60 mb-2 px-2">
          No team tracks assigned.
        </p>
      )}

      <div className="space-y-0.5">
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
      </div>

      {unassignedTeams.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + Add team track
            </Button>
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
        onUpdateDuration(Math.max(1, localDuration));
      }
      setOpen(newOpen);
    },
    [localDuration, duration, onUpdateDuration]
  );

  return (
    <div className="flex items-center gap-3 min-h-8 py-1 rounded-md px-2 -mx-2 hover:bg-accent/30 group">
      <div className="size-4 shrink-0 flex items-center justify-center">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: team.color }}
        />
      </div>

      <span className="text-sm font-medium truncate min-w-0 flex-1">{team.name}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <Popover open={open} onOpenChange={handleClose}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-xs tabular-nums font-medium px-1.5 py-0.5 rounded-md hover:bg-accent transition-colors"
            >
              {duration}d
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <div className="flex items-center gap-2">
              <NumberStepper
                value={localDuration}
                onChange={(v) => setLocalDuration(Math.max(1, v))}
                min={1}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                {localDuration === 1 ? "day" : "days"}
              </span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
