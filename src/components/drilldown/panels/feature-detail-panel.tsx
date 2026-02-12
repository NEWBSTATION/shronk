"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  Trash2,
  Link,
  Clock,
  Users,
  Timer,
  ArrowLeft,
  Ellipsis,
  Layers3,
  FileText,
  CircleDot,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { PropertyRow } from "@/components/ui/property-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";
import {
  computeDurationDays,
  computeEndDateFromDuration,
  bestFitDurationUnit,
  DURATION_UNIT_MULTIPLIERS,
  type DurationUnit,
} from "@/components/timeline/transformers";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import type {
  Milestone,
  MilestoneDependency,
  Team,
  MilestoneStatus,
  TeamMilestoneDuration,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MilestoneOption {
  id: string;
  name: string;
}

interface FeatureDetailPanelProps {
  feature?: Milestone | null;
  teams: Team[];
  projectName?: string;
  dependencies?: MilestoneDependency[];
  teamDurations?: TeamMilestoneDuration[];
  onUpdate?: (data: Partial<Milestone> & { id: string; duration?: number }) => Promise<void>;
  onCreate?: (data: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    duration?: number;
    status: MilestoneStatus;
    teamId?: string | null;
  }) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpsertTeamDuration?: (milestoneId: string, teamId: string, duration: number) => Promise<void>;
  onDeleteTeamDuration?: (milestoneId: string, teamId: string) => Promise<void>;
  isLoading?: boolean;
  milestoneOptions?: MilestoneOption[];
  selectedMilestoneId?: string | null;
  onMilestoneChange?: (id: string | null) => void;
  /** Override the default back/close behavior (defaults to drilldown pop) */
  onBack?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Status display helper                                                      */
/* -------------------------------------------------------------------------- */

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; dotClass: string }> = {
  not_started: { label: "Not Started", dotClass: "bg-zinc-400" },
  in_progress: { label: "In Progress", dotClass: "bg-blue-500" },
  on_hold: { label: "On Hold", dotClass: "bg-amber-500" },
  completed: { label: "Completed", dotClass: "bg-emerald-500" },
  cancelled: { label: "Cancelled", dotClass: "bg-zinc-400" },
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

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function FeatureDetailPanel({
  feature,
  teams,
  projectName,
  dependencies = [],
  teamDurations = [],
  onUpdate,
  onCreate,
  onDelete,
  onUpsertTeamDuration,
  onDeleteTeamDuration,
  isLoading,
  milestoneOptions,
  selectedMilestoneId,
  onMilestoneChange,
  onBack: onBackProp,
}: FeatureDetailPanelProps) {
  const { pop } = useDrilldown();
  const back = onBackProp ?? pop;
  const isEditMode = !!feature;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("not_started");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [teamId, setTeamId] = useState<string | null>(null);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const completed = status === "completed";
  const prevStatusRef = useRef<MilestoneStatus>("not_started");

  const isChained = useMemo(() => {
    if (!feature) return false;
    return dependencies.some((d) => d.successorId === feature.id);
  }, [feature, dependencies]);

  useEffect(() => {
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description || "");
      setStatus(feature.status);
      prevStatusRef.current = feature.status === "completed"
        ? "in_progress"
        : feature.status;
      const s = new Date(feature.startDate);
      const e = new Date(feature.endDate);
      setStartDate(s);
      setEndDate(e);
      setTeamId(feature.teamId);
      const days = computeDurationDays(s, e);
      const best = bestFitDurationUnit(days);
      setDurationValue(best.value);
      setDurationUnit(best.unit);
    } else {
      setTitle("");
      setDescription("");
      setStatus("not_started");
      setStartDate(new Date());
      setEndDate(computeEndDateFromDuration(new Date(), 14));
      setTeamId(null);
      setDurationValue(2);
      setDurationUnit("weeks");
    }
  }, [feature]);

  /* ---- Inline save helpers ---- */

  const saveField = useCallback(
    async (patch: Partial<Milestone> & { duration?: number }) => {
      if (!feature || !onUpdate) return;
      await onUpdate({ id: feature.id, ...patch });
    },
    [feature, onUpdate]
  );

  const handleTitleSave = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      if (isEditMode) {
        saveField({ title: newTitle });
      }
    },
    [isEditMode, saveField]
  );

  const handleCompletionToggle = useCallback(() => {
    const newStatus: MilestoneStatus = completed ? prevStatusRef.current : "completed";
    setStatus(newStatus);
    if (isEditMode) {
      saveField({ status: newStatus, progress: newStatus === "completed" ? 100 : 0 });
    }
  }, [completed, isEditMode, saveField]);

  const handleStatusChange = useCallback(
    (newStatus: MilestoneStatus) => {
      if (newStatus !== "completed") {
        prevStatusRef.current = newStatus;
      }
      setStatus(newStatus);
      if (isEditMode) {
        saveField({
          status: newStatus,
          progress: newStatus === "completed" ? 100 : 0,
        });
      }
    },
    [isEditMode, saveField]
  );

  const handleTeamChange = useCallback(
    (value: string) => {
      const newTeamId = value === "none" ? null : value;
      setTeamId(newTeamId);
      if (isEditMode) {
        saveField({ teamId: newTeamId });
      }
    },
    [isEditMode, saveField]
  );

  const handleDurationSave = useCallback(
    (newValue: number, newUnit: DurationUnit) => {
      const totalDays = newValue * DURATION_UNIT_MULTIPLIERS[newUnit];
      setDurationValue(newValue);
      setDurationUnit(newUnit);
      setEndDate(computeEndDateFromDuration(startDate, totalDays));
      if (isEditMode) {
        saveField({ duration: totalDays });
      }
    },
    [isEditMode, saveField, startDate]
  );

  const handleStartDateChange = useCallback(
    (date: Date) => {
      setStartDate(date);
      const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
      setEndDate(computeEndDateFromDuration(date, totalDays));
      if (isEditMode) {
        saveField({ startDate: date });
      }
    },
    [isEditMode, saveField, durationValue, durationUnit]
  );

  const handleDescriptionChange = useCallback(
    (newDescription: string) => {
      setDescription(newDescription);
      if (isEditMode) {
        saveField({ description: newDescription || null });
      }
    },
    [isEditMode, saveField]
  );

  const handleDelete = async () => {
    if (!feature || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(feature.id);
      back();
    } finally {
      setIsDeleting(false);
    }
  };

  // Create mode: explicit submit via button
  const handleCreateSubmit = useCallback(() => {
    if (!onCreate || !title.trim()) return;
    const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
    const computedEnd = computeEndDateFromDuration(startDate, totalDays);
    onCreate({
      title: title.trim(),
      description: description || undefined,
      startDate,
      endDate: computedEnd,
      duration: totalDays,
      status,
      teamId,
    });
    back();
  }, [onCreate, title, durationValue, durationUnit, startDate, status, description, teamId, back]);

  const team = teams.find((t) => t.id === teamId);

  return (
    <div className="p-6 md:p-8 min-w-0">
      {/* Navigation header — matches Dougly: back left, menu right */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={back}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isEditMode && onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete feature
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Title — large heading with completion toggle */}
      <div className="mb-8">
        {projectName && (
          <div className="text-xs text-muted-foreground mb-2">
            {projectName}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCompletionToggle}
            className={cn(
              "shrink-0 rounded-full transition-colors",
              completed
                ? "text-green-500 hover:text-green-600"
                : "text-muted-foreground/40 hover:text-muted-foreground/70"
            )}
            title={completed ? "Mark incomplete" : "Mark completed"}
          >
            {completed ? (
              <svg className="h-7 w-7" viewBox="0 -960 960 960" fill="currentColor">
                <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Z" />
              </svg>
            ) : (
              <svg className="h-7 w-7" viewBox="0 -960 960 960" fill="currentColor">
                <path d="m429-336 238-237-51-51-187 186-85-84-51 51 136 135Zm51 240q-79 0-149-30t-122.5-82.5Q156-261 126-331T96-480q0-80 30-149.5t82.5-122Q261-804 331-834t149-30q80 0 149.5 30t122 82.5Q804-699 834-629.5T864-480q0 79-30 149t-82.5 122.5Q699-156 629.5-126T480-96Zm0-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z" />
              </svg>
            )}
          </button>
          {isEditMode ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== feature?.title) {
                  handleTitleSave(title.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Feature title"
              className={cn(
                "flex-1 bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 outline-none rounded-md px-2 py-0.5 -mx-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors",
                completed
                  ? "text-muted-foreground line-through decoration-muted-foreground/50"
                  : "text-foreground"
              )}
            />
          ) : (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  handleCreateSubmit();
                }
              }}
              placeholder="Feature title"
              autoFocus
              className="flex-1 bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 outline-none rounded-md px-2 py-0.5 -mx-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors text-foreground"
            />
          )}
        </div>
      </div>

      {/* Properties — Dougly-style space-y-0.5 */}
      <div className="space-y-0.5">
        {/* Milestone selector (create mode, features page only) */}
        {milestoneOptions && milestoneOptions.length > 0 && (
          <PropertyRow icon={Layers3} label="Milestone" type="custom">
            <Select
              value={selectedMilestoneId || ""}
              onValueChange={(v) => onMilestoneChange?.(v || null)}
            >
              <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent focus:ring-0">
                <SelectValue placeholder="Select milestone" />
              </SelectTrigger>
              <SelectContent>
                {milestoneOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropertyRow>
        )}

        {/* Team */}
        <PropertyRow icon={Users} label="Team" type="custom">
          <Select
            value={teamId || "none"}
            onValueChange={handleTeamChange}
          >
            <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent focus:ring-0 w-auto gap-2">
              <SelectValue>
                {team ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span>{team.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground/60">Empty</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-muted-foreground">No team</span>
              </SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        {/* Status */}
        <PropertyRow icon={CircleDot} label="Status" type="custom">
          <Select
            value={status}
            onValueChange={(v) => handleStatusChange(v as MilestoneStatus)}
          >
            <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent focus:ring-0 w-auto gap-2">
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

        {/* Duration */}
        <PropertyRow icon={Timer} label="Duration" type="custom">
          <DurationPopover
            durationValue={durationValue}
            durationUnit={durationUnit}
            onSave={handleDurationSave}
          />
        </PropertyRow>

        {/* Start Date */}
        <PropertyRow icon={CalendarIcon} label="Start Date" type="custom">
          {isChained ? (
            <div className="flex items-center gap-2 h-8 px-2">
              <span className="text-sm text-muted-foreground">
                {format(startDate, "MMM d, yyyy")}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                <Link className="h-2.5 w-2.5" />
                Dependency
              </span>
            </div>
          ) : (
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
                  onSelect={(date) => {
                    if (date) handleStartDateChange(date);
                  }}
                  fromDate={TIMELINE_START_DATE}
                  toDate={TIMELINE_END_DATE}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </PropertyRow>

        {/* End Date (computed) */}
        <PropertyRow icon={Clock} label="End Date" type="custom">
          <div className="flex items-center h-8 px-2">
            <span className="text-sm text-muted-foreground">
              {format(endDate, "MMM d, yyyy")}
            </span>
            <span className="text-[11px] text-muted-foreground/40 italic ml-2">
              computed
            </span>
          </div>
        </PropertyRow>

      </div>

      {/* Team Tracks Section */}
      {isEditMode && teams.length > 0 && feature && (
        <TeamTracksSection
          feature={feature}
          teams={teams}
          teamDurations={teamDurations.filter((td) => td.milestoneId === feature.id)}
          onUpsertTeamDuration={onUpsertTeamDuration}
          onDeleteTeamDuration={onDeleteTeamDuration}
        />
      )}

      {/* Description — separated below properties */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-3 mb-2 px-2 -mx-2">
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Description</span>
        </div>
        <RichTextEditor
          content={description}
          onChange={handleDescriptionChange}
          placeholder="Add a description..."
        />
      </div>

      {/* Create mode footer */}
      {!isEditMode && (
        <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-border">
          <Button variant="outline" onClick={back}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubmit}
            disabled={!title.trim()}
          >
            Create Feature
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete feature?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{feature?.title}&quot;. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Team Tracks Section                                                        */
/* -------------------------------------------------------------------------- */

function TeamTracksSection({
  feature,
  teams,
  teamDurations,
  onUpsertTeamDuration,
  onDeleteTeamDuration,
}: {
  feature: Milestone;
  teams: Team[];
  teamDurations: TeamMilestoneDuration[];
  onUpsertTeamDuration?: (milestoneId: string, teamId: string, duration: number) => Promise<void>;
  onDeleteTeamDuration?: (milestoneId: string, teamId: string) => Promise<void>;
}) {
  const assignedTeamIds = new Set(teamDurations.map((td) => td.teamId));
  const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t.id));

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-3 px-2 -mx-2">
        <div className="flex items-center gap-3">
          <Users className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Team Tracks</span>
        </div>
      </div>

      {teamDurations.length === 0 && (
        <p className="text-xs text-muted-foreground/60 mb-3 px-2">
          No team tracks assigned. Add a team to set per-team durations.
        </p>
      )}

      <div className="space-y-2">
        {teamDurations.map((td) => {
          const team = teams.find((t) => t.id === td.teamId);
          if (!team) return null;

          return (
            <div
              key={td.id}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/30 group"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <span className="text-sm font-medium min-w-[80px]">{team.name}</span>

              <div className="flex items-center gap-2 ml-auto">
                <NumberStepper
                  value={td.duration}
                  onChange={(v) => {
                    const newDuration = Math.max(1, v);
                    onUpsertTeamDuration?.(feature.id, td.teamId, newDuration);
                  }}
                  min={1}
                  className="w-16"
                />
                <span className="text-xs text-muted-foreground w-6">
                  {td.duration === 1 ? "day" : "days"}
                </span>

                {td.startDate && (
                  <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                    {format(new Date(td.startDate), "MMM d")} – {format(new Date(td.endDate), "MMM d")}
                  </span>
                )}

                <button
                  onClick={() => onDeleteTeamDuration?.(feature.id, td.teamId)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="Remove team track"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add team track */}
      {unassignedTeams.length > 0 && onUpsertTeamDuration && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              + Add team track
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {unassignedTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => {
                  onUpsertTeamDuration(feature.id, team.id, feature.duration);
                }}
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

/* -------------------------------------------------------------------------- */
/*  Duration Popover                                                           */
/* -------------------------------------------------------------------------- */

function DurationPopover({
  durationValue,
  durationUnit,
  onSave,
}: {
  durationValue: number;
  durationUnit: DurationUnit;
  onSave: (value: number, unit: DurationUnit) => void;
}) {
  const [localValue, setLocalValue] = useState(durationValue);
  const [localUnit, setLocalUnit] = useState(durationUnit);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalValue(durationValue);
      setLocalUnit(durationUnit);
    }
  }, [open, durationValue, durationUnit]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (localValue !== durationValue || localUnit !== durationUnit) {
        onSave(Math.max(1, localValue), localUnit);
      }
    }
    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
        >
          {durationValue}{" "}
          {durationValue === 1
            ? durationUnit.slice(0, -1)
            : durationUnit}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <NumberStepper
            value={localValue}
            onChange={(v) => setLocalValue(Math.max(1, v))}
            min={1}
            className="w-20"
          />
          <Select
            value={localUnit}
            onValueChange={(v) => setLocalUnit(v as DurationUnit)}
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
  );
}
