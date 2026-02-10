"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  Trash2,
  Circle,
  CircleCheck,
  Link,
  Clock,
  Users,
  Timer,
  ArrowLeft,
  Ellipsis,
  Layers3,
  FileText,
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
  isLoading?: boolean;
  milestoneOptions?: MilestoneOption[];
  selectedMilestoneId?: string | null;
  onMilestoneChange?: (id: string | null) => void;
  /** Override the default back/close behavior (defaults to drilldown pop) */
  onBack?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function FeatureDetailPanel({
  feature,
  teams,
  projectName,
  dependencies = [],
  onUpdate,
  onCreate,
  onDelete,
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
  const [completed, setCompleted] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [teamId, setTeamId] = useState<string | null>(null);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isChained = useMemo(() => {
    if (!feature) return false;
    return dependencies.some((d) => d.successorId === feature.id);
  }, [feature, dependencies]);

  useEffect(() => {
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description || "");
      setCompleted(feature.status === "completed");
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
      setCompleted(false);
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
    const newCompleted = !completed;
    setCompleted(newCompleted);
    if (isEditMode) {
      const status: MilestoneStatus = newCompleted ? "completed" : "not_started";
      saveField({ status, progress: newCompleted ? 100 : 0 });
    }
  }, [completed, isEditMode, saveField]);

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

  // Create mode: create on title blur
  const handleCreateOnTitleBlur = useCallback(
    (newTitle: string) => {
      if (!isEditMode && onCreate && newTitle.trim()) {
        setTitle(newTitle);
        const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
        const computedEnd = computeEndDateFromDuration(startDate, totalDays);
        const status: MilestoneStatus = completed ? "completed" : "not_started";
        onCreate({
          title: newTitle,
          description: description || undefined,
          startDate,
          endDate: computedEnd,
          duration: totalDays,
          status,
          teamId,
        });
        back();
      }
    },
    [isEditMode, onCreate, durationValue, durationUnit, startDate, completed, description, teamId, back]
  );

  const team = teams.find((t) => t.id === teamId);

  return (
    <div className="p-8">
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
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleCompletionToggle}
            className={cn(
              "shrink-0 mt-1 rounded-full transition-colors",
              completed
                ? "text-green-500 hover:text-green-600"
                : "text-muted-foreground/40 hover:text-muted-foreground/70"
            )}
            title={completed ? "Mark incomplete" : "Mark completed"}
          >
            {completed ? (
              <CircleCheck className="h-7 w-7" fill="currentColor" />
            ) : (
              <Circle className="h-7 w-7" />
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
              onBlur={() => handleCreateOnTitleBlur(title)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  handleCreateOnTitleBlur(title);
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
        <PropertyRow icon={Clock} label="End Date">
          <span className="text-sm text-muted-foreground">
            {format(endDate, "MMM d, yyyy")}
          </span>
          <span className="text-[11px] text-muted-foreground/40 italic ml-2">
            computed
          </span>
        </PropertyRow>

        {/* Description */}
        <PropertyRow icon={FileText} label="Description" type="custom">
          <div className="w-full -mx-2">
            <RichTextEditor
              content={description}
              onChange={handleDescriptionChange}
              placeholder="Add a description..."
            />
          </div>
        </PropertyRow>
      </div>

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
