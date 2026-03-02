"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  Bolt,
  CalendarIcon,
  Trash2,
  Link,
  Clock,
  Users,
  Timer,
  ArrowLeft,
  Ellipsis,
  CircleDot,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  Plus,
  X,
  Ban,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
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
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { priorityConfig, PriorityHighIcon } from "@/components/shared/status-badge";
import { formatDuration } from "@/lib/format-duration";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";
import {
  computeDurationDays,
  computeEndDateFromDuration,
  bestFitDurationUnit,
  toLocalMidnight,
  DURATION_UNIT_MULTIPLIERS,
  type DurationUnit,
} from "@/components/timeline/transformers";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { useMilestones } from "@/hooks/use-milestones";
import type {
  Milestone,
  MilestoneDependency,
  Team,
  MilestoneStatus,
  MilestonePriority,
  TeamMilestoneDuration,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MilestoneOption {
  id: string;
  name: string;
}

export interface PanelChainTo {
  featureId: string;
  featureTitle: string;
  endDate: Date;
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
    teamTracks?: { teamId: string; duration: number }[];
    chainToId?: string;
  }) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpsertTeamDuration?: (milestoneId: string, teamId: string, duration: number) => Promise<void>;
  onDeleteTeamDuration?: (milestoneId: string, teamId: string) => Promise<void>;
  onCreateDependency?: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency?: (depId: string) => Promise<void>;
  isLoading?: boolean;
  milestoneOptions?: MilestoneOption[];
  selectedMilestoneId?: string | null;
  onMilestoneChange?: (id: string | null) => void;
  /** Override the default back/close behavior (defaults to drilldown pop) */
  onBack?: () => void;
  /** Chain to a predecessor feature (create mode only) */
  chainTo?: PanelChainTo | null;
  /** Whether chain should be initially enabled */
  chainEnabled?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Status display helper                                                      */
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
  onCreateDependency,
  onDeleteDependency,
  isLoading,
  milestoneOptions,
  selectedMilestoneId,
  onMilestoneChange,
  onBack: onBackProp,
  chainTo,
  chainEnabled: chainEnabledProp = false,
}: FeatureDetailPanelProps) {
  const { pop } = useDrilldown();
  const back = onBackProp ?? pop;
  const isEditMode = !!feature;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descSaved, setDescSaved] = useState(false);
  const [status, setStatus] = useState<MilestoneStatus>("not_started");
  const [priority, setPriority] = useState<MilestonePriority>("none");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingTeamTracks, setPendingTeamTracks] = useState<Map<string, number>>(new Map());
  const [chainActive, setChainActive] = useState(false);
  const [hideEmptyProps, setHideEmptyProps] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const completed = status === "completed";
  const prevStatusRef = useRef<MilestoneStatus>("not_started");

  // Subscribe to live query data so undo / external changes sync into the panel
  const { data: liveData } = useMilestones({ projectId: feature?.projectId ?? "" });
  const liveFeature = useMemo(() => {
    if (!feature || !liveData) return null;
    return liveData.milestones.find((m) => m.id === feature.id) ?? null;
  }, [feature, liveData]);

  // Sync discrete fields when live data diverges (e.g. after Ctrl+Z undo)
  // Uses functional updaters so React bails out if values already match.
  useEffect(() => {
    if (!liveFeature || !isEditMode) return;
    setTitle((prev) => prev !== liveFeature.title ? liveFeature.title : prev);
    setStatus((prev) => prev !== liveFeature.status ? liveFeature.status : prev);
    setPriority((prev) => prev !== liveFeature.priority ? liveFeature.priority : prev);
    const s = toLocalMidnight(liveFeature.startDate);
    const e = toLocalMidnight(liveFeature.endDate);
    setStartDate(s);
    setEndDate(e);
    const days = computeDurationDays(s, e);
    const best = bestFitDurationUnit(days);
    setDurationValue(best.value);
    setDurationUnit(best.unit);
    // Skip description — it has its own debounce/save + "Saved" indicator
  }, [liveFeature?.status, liveFeature?.priority, liveFeature?.title,
      liveFeature?.startDate, liveFeature?.endDate, liveFeature?.duration, isEditMode]);

  const isChained = useMemo(() => {
    if (!feature) return false;
    return dependencies.some((d) => d.successorId === feature.id);
  }, [feature, dependencies]);

  useEffect(() => {
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description || "");
      setStatus(feature.status);
      setPriority(feature.priority);
      prevStatusRef.current = feature.status === "completed"
        ? "in_progress"
        : feature.status;
      const s = toLocalMidnight(feature.startDate);
      const e = toLocalMidnight(feature.endDate);
      setStartDate(s);
      setEndDate(e);
      const days = computeDurationDays(s, e);
      const best = bestFitDurationUnit(days);
      setDurationValue(best.value);
      setDurationUnit(best.unit);
    } else {
      setTitle("");
      setDescription("");
      setStatus("not_started");
      setPriority("medium");
      const shouldChain = chainEnabledProp && !!chainTo;
      setChainActive(shouldChain);
      if (shouldChain && chainTo) {
        const chainStart = new Date(chainTo.endDate);
        chainStart.setDate(chainStart.getDate() + 1);
        setStartDate(chainStart);
        setEndDate(computeEndDateFromDuration(chainStart, 14));
      } else {
        setStartDate(new Date());
        setEndDate(computeEndDateFromDuration(new Date(), 14));
      }
      setDurationValue(2);
      setDurationUnit("weeks");
      // Pre-populate team tracks from teams with autoAdd enabled
      const autoAddTeams = teams.filter((t) => t.autoAdd);
      if (autoAddTeams.length > 0) {
        setPendingTeamTracks(new Map(autoAddTeams.map((t) => [t.id, 14])));
      }
    }
  }, [feature, chainTo, chainEnabledProp, teams]);

  /* ---- Inline save helpers ---- */

  const saveField = useCallback(
    async (patch: Partial<Milestone> & { duration?: number }) => {
      if (!feature || !onUpdate) return;
      await onUpdate({ id: feature.id, ...patch });
    },
    [feature, onUpdate]
  );

  // Keep a ref to the latest saveField so the debounce flush on unmount
  // always calls the current version (avoids stale closure).
  const saveFieldRef = useRef(saveField);
  saveFieldRef.current = saveField;

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

  const handlePriorityChange = useCallback(
    (newPriority: MilestonePriority) => {
      setPriority(newPriority);
      if (isEditMode) {
        saveField({ priority: newPriority });
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

  // --- Debounced description save ---
  const descriptionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDescriptionRef = useRef<string | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush any pending description save on unmount so edits aren't lost
  useEffect(() => {
    return () => {
      if (descriptionTimerRef.current) {
        clearTimeout(descriptionTimerRef.current);
        descriptionTimerRef.current = null;
      }
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
        savedIndicatorTimerRef.current = null;
      }
      if (pendingDescriptionRef.current !== null) {
        saveFieldRef.current({ description: pendingDescriptionRef.current || null });
        pendingDescriptionRef.current = null;
      }
    };
  }, []);

  const handleDescriptionChange = useCallback(
    (newDescription: string) => {
      if (!isEditMode) {
        // Create mode — keep React state for the submit handler
        setDescription(newDescription);
        return;
      }

      // Edit mode — skip setState, TipTap owns the DOM. Only use the ref for debounce.
      pendingDescriptionRef.current = newDescription;

      // Hide "Saved" indicator immediately (functional updater avoids re-render when already false)
      setDescSaved((prev) => prev ? false : prev);
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
        savedIndicatorTimerRef.current = null;
      }

      if (descriptionTimerRef.current) {
        clearTimeout(descriptionTimerRef.current);
      }
      descriptionTimerRef.current = setTimeout(async () => {
        descriptionTimerRef.current = null;
        const pending = pendingDescriptionRef.current;
        pendingDescriptionRef.current = null;
        if (pending !== null) {
          await saveField({ description: pending || null });
          setDescSaved(true);
          savedIndicatorTimerRef.current = setTimeout(() => {
            savedIndicatorTimerRef.current = null;
            setDescSaved(false);
          }, 2000);
        }
      }, 800);
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
    const teamTracks = pendingTeamTracks.size > 0
      ? Array.from(pendingTeamTracks, ([teamId, duration]) => ({ teamId, duration }))
      : undefined;
    onCreate({
      title: title.trim(),
      description: description || undefined,
      startDate,
      endDate: computedEnd,
      duration: totalDays,
      status,
      teamTracks,
      chainToId: chainActive && chainTo ? chainTo.featureId : undefined,
    });
    back();
  }, [onCreate, title, durationValue, durationUnit, startDate, status, description, back, pendingTeamTracks, chainActive, chainTo]);

  return (
    <div className="min-w-0">
      <div ref={sentinelRef} className="h-0" />
      {/* Sticky header — icon + title stick to top on scroll */}
      <div className="sticky top-0 z-10 bg-background px-3 md:px-8 pt-6 md:pt-8 pb-4 relative">
        <div className={cn(
          "absolute bottom-0 left-6 right-6 md:left-8 md:right-8 h-px transition-colors",
          isStuck ? "bg-border" : "bg-transparent"
        )} />
        <div className={cn(
          "absolute top-full left-0 right-0 h-4 pointer-events-none transition-opacity bg-gradient-to-b from-background to-transparent",
          isStuck ? "opacity-100" : "opacity-0"
        )} />
        {/* Navigation header — back left, menu right */}
        <div className="flex items-center mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 -ml-2"
            onClick={back}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {isEditMode && onDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
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
          ) : (
            <div className="h-8 w-8 shrink-0" />
          )}
        </div>

        {/* Title */}
        <div className="flex items-center gap-3">
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
                "flex-1 min-w-0 bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 outline-none rounded-md px-2 pt-0.5 pb-1 -ml-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors overflow-hidden text-ellipsis",
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
              className="flex-1 min-w-0 bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 outline-none rounded-md px-2 pt-0.5 pb-1 -ml-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors text-foreground overflow-hidden text-ellipsis"
            />
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="px-3 md:px-8 pb-6 md:pb-8">

      {/* Properties — Dougly-style space-y-0.5 */}
      <div className="space-y-0.5">
        {/* Status */}
        <PropertyRow icon={CircleDot} label="Status" type="custom">
          <Select
            value={status}
            onValueChange={(v) => handleStatusChange(v as MilestoneStatus)}
          >
            <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent focus:ring-0 w-auto gap-2 [&>svg:last-child]:hidden">
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

        {/* Milestone selector */}
        {milestoneOptions && milestoneOptions.length > 0 && (
          <PropertyRow icon={Bolt} label="Milestone" type="custom">
            <Select
              value={selectedMilestoneId || ""}
              onValueChange={(v) => onMilestoneChange?.(v || null)}
            >
              <SelectTrigger className="border-0 shadow-none h-8 px-2 text-sm hover:bg-accent/50 focus:ring-0 bg-transparent dark:bg-transparent dark:hover:bg-accent/50 [&>svg:last-child]:hidden">
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

        {/* Priority */}
        {!(hideEmptyProps && priority === "none") && (
          <PropertyRow icon={PriorityHighIcon} label="Priority" type="custom">
            <Select
              value={priority}
              onValueChange={(v) => handlePriorityChange(v as MilestonePriority)}
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
        )}

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
          {isChained || chainActive ? (
            <div className="flex items-center gap-2 h-8 px-2">
              <span className="text-sm text-muted-foreground">
                {format(startDate, "MMM d, yyyy")}
              </span>
              {isChained && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                  <Link className="h-2.5 w-2.5" />
                  Dependency
                </span>
              )}
            </div>
          ) : (
            <ResponsivePopover>
              <ResponsivePopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  {format(startDate, "MMM d, yyyy")}
                </button>
              </ResponsivePopoverTrigger>
              <ResponsivePopoverContent className="w-auto p-0" align="start" title="Start Date">
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
              </ResponsivePopoverContent>
            </ResponsivePopover>
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

        {/* Team Tracks — edit mode (API-backed) */}
        {isEditMode && teams.length > 0 && feature && !(hideEmptyProps && teamDurations.filter((td) => td.milestoneId === feature.id).length === 0) && (
          <TeamTracksProperty
            feature={feature}
            teams={teams}
            teamDurations={teamDurations.filter((td) => td.milestoneId === feature.id)}
            onUpsertTeamDuration={onUpsertTeamDuration}
            onDeleteTeamDuration={onDeleteTeamDuration}
          />
        )}

        {/* Team Tracks — create mode (local state) */}
        {!isEditMode && teams.length > 0 && !(hideEmptyProps && pendingTeamTracks.size === 0) && (
          <PendingTeamTracksProperty
            teams={teams}
            pendingTracks={pendingTeamTracks}
            defaultDuration={durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit]}
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

        {/* Hide empty properties toggle */}
        <button
          type="button"
          onClick={() => setHideEmptyProps((v) => !v)}
          className="flex items-center gap-3 min-h-8 py-1.5 rounded-md px-2 -mx-2 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30 transition-colors"
        >
          <div className="shrink-0">
            {hideEmptyProps ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </div>
          <span>{hideEmptyProps ? "Show empty properties" : "Hide empty properties"}</span>
        </button>
      </div>

      {/* Dependencies Section — edit mode */}
      {isEditMode && feature && (
        <DependenciesSection
          feature={feature}
          dependencies={dependencies}
          onCreateDependency={onCreateDependency}
          onDeleteDependency={onDeleteDependency}
        />
      )}

      {/* Description */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2 -mx-2">
          <AlignLeft className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Description</span>
        </div>
        <RichTextEditor
          content={description}
          onChange={handleDescriptionChange}
          saveStatus={isEditMode && descSaved ? "saved" : "idle"}
        />
      </div>

      {/* Create mode footer */}
      {!isEditMode && (
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-border">
          {chainTo && (
            <label className="flex items-center gap-2 cursor-pointer select-none mr-auto">
              <Switch
                size="sm"
                checked={chainActive}
                onCheckedChange={(checked) => {
                  setChainActive(checked);
                  if (checked && chainTo) {
                    const chainStart = new Date(chainTo.endDate);
                    chainStart.setDate(chainStart.getDate() + 1);
                    setStartDate(chainStart);
                    setEndDate(computeEndDateFromDuration(chainStart, durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit]));
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">Auto-Chain</span>
            </label>
          )}
          <div className="flex gap-2 ml-auto">
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
        </div>
      )}

      {/* Scroll spacer */}
      <div className="h-[40vh]" />

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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Team Tracks Section                                                        */
/* -------------------------------------------------------------------------- */

function TeamTracksProperty({
  feature,
  teams,
  teamDurations: teamDurationsProp,
  onUpsertTeamDuration,
  onDeleteTeamDuration,
}: {
  feature: Milestone;
  teams: Team[];
  teamDurations: TeamMilestoneDuration[];
  onUpsertTeamDuration?: (milestoneId: string, teamId: string, duration: number) => Promise<void>;
  onDeleteTeamDuration?: (milestoneId: string, teamId: string) => Promise<void>;
}) {
  // Subscribe to the milestones query for reactive updates (the prop may be a stale snapshot from a drilldown push)
  const { data: milestonesData } = useMilestones({ projectId: feature.projectId });
  const teamDurations = useMemo(() => {
    if (!milestonesData?.teamDurations) return teamDurationsProp;
    return milestonesData.teamDurations.filter((td) => td.milestoneId === feature.id);
  }, [milestonesData?.teamDurations, feature.id, teamDurationsProp]);

  const assignedTeamIds = new Set(teamDurations.map((td) => td.teamId));
  const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t.id));
  const assignedTeams = teamDurations
    .map((td) => teams.find((t) => t.id === td.teamId))
    .filter(Boolean) as Team[];

  return (
    <PropertyRow icon={Users} label="Teams" type="custom">
      <ResponsivePopover>
        <Tooltip>
          <TooltipTrigger asChild>
            <ResponsivePopoverTrigger asChild>
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
            </ResponsivePopoverTrigger>
          </TooltipTrigger>
          {assignedTeams.length > 1 && (
            <TooltipContent side="bottom" align="start" className="p-0 bg-foreground">
              <div className="flex flex-col gap-0.5 py-1.5 px-2">
                {teamDurations.map((td) => {
                  const team = assignedTeams.find((t) => t.id === td.teamId);
                  if (!team) return null;
                  return (
                    <div key={td.id} className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-xs">{team.name}</span>
                      <span className="text-xs text-background/50 ml-auto pl-3">
                        {formatDuration(td.duration)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
        <ResponsivePopoverContent className="w-72 p-0" align="start" title="Team Tracks">
          <div className="p-2 space-y-0.5">
            {teamDurations.map((td) => {
              const team = teams.find((t) => t.id === td.teamId);
              if (!team) return null;
              return (
                <TeamTrackRow
                  key={td.id}
                  td={td}
                  team={team}
                  feature={feature}
                  onUpsertTeamDuration={onUpsertTeamDuration}
                  onDeleteTeamDuration={onDeleteTeamDuration}
                />
              );
            })}
            {unassignedTeams.length > 0 && onUpsertTeamDuration && (
              <AddTeamPopover
                teams={unassignedTeams}
                placeholder="Search teams..."
                onSelect={(teamId) => onUpsertTeamDuration(feature.id, teamId, feature.duration)}
              />
            )}
          </div>
        </ResponsivePopoverContent>
      </ResponsivePopover>
    </PropertyRow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Searchable Add Team Popover                                                */
/* -------------------------------------------------------------------------- */

function AddTeamPopover({
  teams,
  placeholder,
  onSelect,
}: {
  teams: Team[];
  placeholder: string;
  onSelect: (teamId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <ResponsivePopover onOpenChange={(open) => { if (!open) setSearch(""); }}>
      <ResponsivePopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 min-h-7 py-0.5 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <Plus className="h-2 w-2 shrink-0" />
          <span>Add team</span>
        </button>
      </ResponsivePopoverTrigger>
      <ResponsivePopoverContent
        className="w-48 p-0"
        align="start"
        title="Add Team Track"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-1.5 pt-1.5 pb-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full h-7 px-2 text-xs rounded-md bg-muted/50 border border-border/40 outline-none placeholder:text-muted-foreground/50 focus:border-ring"
          />
        </div>
        <div className="flex flex-col p-1 pt-0 max-h-48 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((team) => (
            <button
              key={team.id}
              onClick={() => onSelect(team.id)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: team.color }}
              />
              {team.name}
            </button>
          )) : (
            <p className="px-2 py-2 text-xs text-center text-muted-foreground">No matches</p>
          )}
        </div>
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Team Track Row                                                              */
/* -------------------------------------------------------------------------- */

function TeamTrackRow({
  td,
  team,
  feature,
  onUpsertTeamDuration,
  onDeleteTeamDuration,
}: {
  td: TeamMilestoneDuration;
  team: Team;
  feature: Milestone;
  onUpsertTeamDuration?: (milestoneId: string, teamId: string, duration: number) => Promise<void>;
  onDeleteTeamDuration?: (milestoneId: string, teamId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const bestFit = useMemo(() => bestFitDurationUnit(td.duration), [td.duration]);
  const [localValue, setLocalValue] = useState(bestFit.value);
  const [localUnit, setLocalUnit] = useState<DurationUnit>(bestFit.unit);
  useEffect(() => {
    if (open) {
      const fit = bestFitDurationUnit(td.duration);
      setLocalValue(fit.value);
      setLocalUnit(fit.unit);
    }
  }, [open, td.duration]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        const totalDays = Math.max(0, localValue * DURATION_UNIT_MULTIPLIERS[localUnit]);
        if (totalDays !== td.duration) {
          onUpsertTeamDuration?.(feature.id, td.teamId, totalDays);
        }
      }
      setOpen(newOpen);
    },
    [localValue, localUnit, td.duration, td.teamId, feature.id, onUpsertTeamDuration]
  );

  const durationLabel = formatDuration(td.duration);
  const dateRange =
    td.startDate && td.endDate
      ? `${format(toLocalMidnight(td.startDate), "MMM d")} – ${format(toLocalMidnight(td.endDate), "MMM d")}`
      : null;

  return (
    <div className="flex items-center gap-2 min-h-7 py-0.5 rounded-md hover:bg-accent/30 group">
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: team.color }}
      />
      <span className="text-sm truncate min-w-0 flex-1">{team.name}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <ResponsivePopover open={open} onOpenChange={handleClose}>
          <ResponsivePopoverTrigger asChild>
            <button
              type="button"
              className="text-xs tabular-nums text-muted-foreground px-1.5 py-0.5 rounded-md hover:bg-accent transition-colors"
            >
              {durationLabel}
            </button>
          </ResponsivePopoverTrigger>
          <ResponsivePopoverContent className="w-auto p-3" align="end" title="Duration">
            <p className="text-xs text-muted-foreground mb-2">Duration</p>
            <div className="flex items-center gap-2">
              <NumberStepper
                value={localValue}
                onChange={(v) => setLocalValue(Math.max(0, v))}
                min={0}
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
          </ResponsivePopoverContent>
        </ResponsivePopover>

        {dateRange && (
          <span className="text-[11px] text-muted-foreground/50 tabular-nums hidden sm:inline">
            {dateRange}
          </span>
        )}
      </div>

      <button
        onClick={() => onDeleteTeamDuration?.(feature.id, td.teamId)}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
        title="Remove team track"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pending Team Tracks (create mode — local state only)                       */
/* -------------------------------------------------------------------------- */

function PendingTeamTracksProperty({
  teams,
  pendingTracks,
  defaultDuration,
  onAdd,
  onUpdateDuration,
  onRemove,
}: {
  teams: Team[];
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
    .filter(Boolean) as Team[];

  return (
    <PropertyRow icon={Users} label="Teams" type="custom">
      <ResponsivePopover>
        <Tooltip>
          <TooltipTrigger asChild>
            <ResponsivePopoverTrigger asChild>
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
            </ResponsivePopoverTrigger>
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
                        {formatDuration(duration)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
        <ResponsivePopoverContent className="w-72 p-0" align="start" title="Team Tracks">
          <div className="p-2 space-y-0.5">
            {Array.from(pendingTracks).map(([teamId, duration]) => {
              const team = teams.find((t) => t.id === teamId);
              if (!team) return null;
              return (
                <PendingTeamTrackRow
                  key={teamId}
                  team={team}
                  duration={duration}
                  onUpdateDuration={(d) => onUpdateDuration(teamId, d)}
                  onRemove={() => onRemove(teamId)}
                />
              );
            })}
            {unassignedTeams.length > 0 && (
              <AddTeamPopover
                teams={unassignedTeams}
                placeholder="Search teams..."
                onSelect={(teamId) => onAdd(teamId, defaultDuration)}
              />
            )}
          </div>
        </ResponsivePopoverContent>
      </ResponsivePopover>
    </PropertyRow>
  );
}

function PendingTeamTrackRow({
  team,
  duration,
  onUpdateDuration,
  onRemove,
}: {
  team: Team;
  duration: number;
  onUpdateDuration: (duration: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const bestFit = useMemo(() => bestFitDurationUnit(duration), [duration]);
  const [localValue, setLocalValue] = useState(bestFit.value);
  const [localUnit, setLocalUnit] = useState<DurationUnit>(bestFit.unit);

  useEffect(() => {
    if (open) {
      const fit = bestFitDurationUnit(duration);
      setLocalValue(fit.value);
      setLocalUnit(fit.unit);
    }
  }, [open, duration]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        const totalDays = Math.max(0, localValue * DURATION_UNIT_MULTIPLIERS[localUnit]);
        if (totalDays !== duration) {
          onUpdateDuration(totalDays);
        }
      }
      setOpen(newOpen);
    },
    [localValue, localUnit, duration, onUpdateDuration]
  );

  const durationLabel = formatDuration(duration);

  return (
    <div className="flex items-center gap-2 min-h-7 py-0.5 rounded-md hover:bg-accent/30 group">
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: team.color }}
      />
      <span className="text-sm truncate min-w-0 flex-1">{team.name}</span>

      <ResponsivePopover open={open} onOpenChange={handleClose}>
        <ResponsivePopoverTrigger asChild>
          <button
            type="button"
            className="text-xs tabular-nums text-muted-foreground px-1.5 py-0.5 rounded-md hover:bg-accent transition-colors shrink-0"
          >
            {durationLabel}
          </button>
        </ResponsivePopoverTrigger>
        <ResponsivePopoverContent className="w-auto p-3" align="end" title="Duration">
          <p className="text-xs text-muted-foreground mb-2">Duration</p>
          <div className="flex items-center gap-2">
            <NumberStepper
              value={localValue}
              onChange={(v) => setLocalValue(Math.max(0, v))}
              min={0}
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
        </ResponsivePopoverContent>
      </ResponsivePopover>

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

/* -------------------------------------------------------------------------- */
/*  Dependencies Section (ClickUp-style)                                       */
/* -------------------------------------------------------------------------- */

function DependenciesSection({
  feature,
  dependencies,
  onCreateDependency,
  onDeleteDependency,
}: {
  feature: Milestone;
  dependencies: MilestoneDependency[];
  onCreateDependency?: (predecessorId: string, successorId: string) => Promise<void>;
  onDeleteDependency?: (depId: string) => Promise<void>;
}) {
  const { data: liveData } = useMilestones({ projectId: feature.projectId });
  const liveDeps = useMemo(() => {
    if (!liveData?.dependencies) return dependencies;
    return liveData.dependencies;
  }, [liveData?.dependencies, dependencies]);

  const allFeatures = liveData?.milestones ?? [];
  const featureMap = useMemo(() => new Map(allFeatures.map((f) => [f.id, f])), [allFeatures]);

  const blocking = useMemo(
    () => liveDeps.filter((d) => d.predecessorId === feature.id),
    [liveDeps, feature.id]
  );
  const blockedBy = useMemo(
    () => liveDeps.filter((d) => d.successorId === feature.id),
    [liveDeps, feature.id]
  );

  const hasDeps = blocking.length > 0 || blockedBy.length > 0;

  const [pickerDirection, setPickerDirection] = useState<"blocking" | "blocked_by" | null>(null);

  const handleClearAll = useCallback(async () => {
    if (!onDeleteDependency) return;
    const featureDeps = liveDeps.filter(
      (d) => d.predecessorId === feature.id || d.successorId === feature.id
    );
    for (const dep of featureDeps) {
      await onDeleteDependency(dep.id);
    }
  }, [liveDeps, feature.id, onDeleteDependency]);

  // Build rows: each row has { groupLabel (only for first in group), dep, linkedFeature }
  const rows = useMemo(() => {
    const result: Array<{
      groupLabel: string | null;
      groupType: "blocking" | "blocked_by";
      dep: MilestoneDependency;
      linkedFeature: Milestone | undefined;
    }> = [];
    blocking.forEach((dep, i) => {
      result.push({
        groupLabel: i === 0 ? "Blocking" : null,
        groupType: "blocking",
        dep,
        linkedFeature: featureMap.get(dep.successorId),
      });
    });
    blockedBy.forEach((dep, i) => {
      result.push({
        groupLabel: i === 0 ? "Blocked by" : null,
        groupType: "blocked_by",
        dep,
        linkedFeature: featureMap.get(dep.predecessorId),
      });
    });
    return result;
  }, [blocking, blockedBy, featureMap]);

  if (!hasDeps && !onCreateDependency) return null;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      {/* Two-column dependency grid */}
      {rows.length > 0 && (
        <div className="flex flex-col">
          {rows.map((row) => (
            <DependencyRow
              key={row.dep.id}
              groupLabel={row.groupLabel}
              groupType={row.groupType}
              depId={row.dep.id}
              featureName={row.linkedFeature?.title ?? "Unknown"}
              featureStatus={(row.linkedFeature?.status as MilestoneStatus) ?? "not_started"}
              onDelete={onDeleteDependency}
              onAdd={onCreateDependency ? setPickerDirection : undefined}
            />
          ))}
        </div>
      )}

      {/* Empty state with add button */}
      {!hasDeps && onCreateDependency && (
        <DepAddDropdown
          hasDeps={false}
          onPickDirection={setPickerDirection}
          onClearAll={handleClearAll}
          onDeleteDependency={onDeleteDependency}
        >
          <button
            type="button"
            className="flex items-center gap-3 min-h-8 py-1.5 rounded-md px-2 -mx-2 text-sm text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30 transition-colors"
          >
            <Plus className="size-4 shrink-0" />
            <span>Add dependency</span>
          </button>
        </DepAddDropdown>
      )}

      {/* Feature picker popover */}
      {pickerDirection && onCreateDependency && (
        <FeaturePickerPopover
          feature={feature}
          direction={pickerDirection}
          allFeatures={allFeatures}
          liveDeps={liveDeps}
          onCreateDependency={onCreateDependency}
          onClose={() => setPickerDirection(null)}
        />
      )}
    </div>
  );
}

function DependencyRow({
  groupLabel,
  groupType,
  depId,
  featureName,
  featureStatus,
  onDelete,
  onAdd,
}: {
  groupLabel: string | null;
  groupType: "blocking" | "blocked_by";
  depId: string;
  featureName: string;
  featureStatus: MilestoneStatus;
  onDelete?: (depId: string) => Promise<void>;
  onAdd?: (direction: "blocking" | "blocked_by") => void;
}) {
  const statusCfg = STATUS_CONFIG[featureStatus];

  return (
    <div className="flex items-center gap-3 min-h-8 py-1.5 px-2 -mx-2">
      {/* Left: icon + group label (only on first row of each group) — matches PropertyRow */}
      <div className="shrink-0">
        {groupLabel ? (
          groupType === "blocking" ? (
            <Ban className="size-4 text-red-500" />
          ) : (
            <AlertTriangle className="size-4 text-amber-500" />
          )
        ) : (
          <div className="size-4" />
        )}
      </div>
      <span className="w-24 sm:w-32 shrink-0 text-sm text-muted-foreground">
        {groupLabel ?? ""}
      </span>

      {/* Right: status dot + feature name + hover actions */}
      <div className="flex items-center gap-2 min-w-0 flex-1 rounded-md px-2 -mx-2 py-1 hover:bg-accent/30 group/deprow">
        <div className={cn("h-2 w-2 rounded-full shrink-0", statusCfg.dotClass)} />
        <span className="text-sm truncate min-w-0 flex-1">{featureName}</span>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/deprow:opacity-100 transition-opacity">
          {onDelete && (
            <button
              onClick={() => onDelete(depId)}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
              title="Remove dependency"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {onAdd && (
            <DepAddDropdown
              hasDeps
              onPickDirection={onAdd}
              onClearAll={() => {}}
              onDeleteDependency={undefined}
            >
              <button
                className="p-1 rounded hover:bg-accent text-muted-foreground/60 hover:text-foreground transition-colors"
                title="Add dependency"
              >
                <Plus className="h-3 w-3" />
              </button>
            </DepAddDropdown>
          )}
        </div>
      </div>
    </div>
  );
}

function DepAddDropdown({
  hasDeps,
  onPickDirection,
  onClearAll,
  onDeleteDependency,
  children,
}: {
  hasDeps: boolean;
  onPickDirection: (direction: "blocking" | "blocked_by") => void;
  onClearAll: () => void;
  onDeleteDependency?: (depId: string) => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => onPickDirection("blocking")}>
          This feature blocks...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPickDirection("blocked_by")}>
          This feature is blocked by...
        </DropdownMenuItem>
        {hasDeps && onDeleteDependency && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onClearAll}
            >
              Clear all dependencies
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FeaturePickerPopover({
  feature,
  direction,
  allFeatures,
  liveDeps,
  onCreateDependency,
  onClose,
}: {
  feature: Milestone;
  direction: "blocking" | "blocked_by";
  allFeatures: Milestone[];
  liveDeps: MilestoneDependency[];
  onCreateDependency: (predecessorId: string, successorId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add(feature.id);
    for (const d of liveDeps) {
      if (d.predecessorId === feature.id || d.successorId === feature.id) {
        ids.add(d.predecessorId);
        ids.add(d.successorId);
      }
    }
    return ids;
  }, [liveDeps, feature.id]);

  const candidates = useMemo(() => {
    return allFeatures.filter(
      (f) => !linkedIds.has(f.id) && f.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [allFeatures, linkedIds, search]);

  const handleSelect = async (targetId: string) => {
    if (direction === "blocking") {
      await onCreateDependency(feature.id, targetId);
    } else {
      await onCreateDependency(targetId, feature.id);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xs p-0 gap-0">
        <DialogHeader className="px-3 pt-3 pb-2">
          <DialogTitle className="text-sm font-medium">
            {direction === "blocking" ? "This blocks..." : "Blocked by..."}
          </DialogTitle>
        </DialogHeader>
        <div className="px-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features..."
            autoFocus
            className="w-full h-8 px-2.5 text-sm rounded-md bg-muted/50 border border-border/40 outline-none placeholder:text-muted-foreground/50 focus:border-ring"
          />
        </div>
        <div className="flex flex-col px-1.5 pb-2 max-h-56 overflow-y-auto">
          {candidates.length > 0 ? candidates.map((f) => {
            const sCfg = STATUS_CONFIG[(f.status as MilestoneStatus) ?? "not_started"];
            return (
              <button
                key={f.id}
                onClick={() => handleSelect(f.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
              >
                <div className={cn("h-2 w-2 rounded-full shrink-0", sCfg.dotClass)} />
                <span className="truncate">{f.title}</span>
              </button>
            );
          }) : (
            <p className="px-2 py-3 text-xs text-center text-muted-foreground">No features available</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
        onSave(Math.max(0, localValue), localUnit);
      }
    }
    setOpen(newOpen);
  };

  return (
    <ResponsivePopover open={open} onOpenChange={handleOpenChange}>
      <ResponsivePopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
        >
          {durationValue}{" "}
          {durationValue === 1
            ? durationUnit.slice(0, -1)
            : durationUnit}
        </button>
      </ResponsivePopoverTrigger>
      <ResponsivePopoverContent className="w-auto p-3" align="start" title="Duration">
        <div className="flex items-center gap-2">
          <NumberStepper
            value={localValue}
            onChange={(v) => setLocalValue(Math.max(0, v))}
            min={0}
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
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}
