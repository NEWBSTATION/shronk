"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
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
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useLayoutStore,
  FEATURE_SHEET_MIN_WIDTH,
  FEATURE_SHEET_MAX_WIDTH,
  FEATURE_SHEET_DEFAULT_WIDTH,
} from "@/store/layout-store";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/gantt/constants";
import {
  computeDurationDays,
  computeEndDateFromDuration,
  bestFitDurationUnit,
  DURATION_UNIT_MULTIPLIERS,
  type DurationUnit,
} from "@/components/gantt/transformers";
import type {
  Milestone,
  MilestoneDependency,
  Team,
  MilestoneStatus,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Property row — flat ClickUp style                                          */
/* -------------------------------------------------------------------------- */

function PropertyRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon?: React.ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center min-h-[44px] py-2",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 w-[160px] shrink-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/60" />}
        <span className="text-sm font-medium text-foreground/80">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MilestoneOption {
  id: string;
  name: string;
}

interface FeatureSheetProps {
  feature?: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function FeatureSheet({
  feature,
  open,
  onOpenChange,
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
}: FeatureSheetProps) {
  const isEditMode = !!feature;

  const featureSheetWidth = useLayoutStore((s) => s.featureSheetWidth);
  const setFeatureSheetWidth = useLayoutStore((s) => s.setFeatureSheetWidth);
  const resetFeatureSheetWidth = useLayoutStore((s) => s.resetFeatureSheetWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (ev: MouseEvent) => {
      const container = document.querySelector('[data-slot="sidebar-inset"]');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setFeatureSheetWidth(rect.right - ev.clientX);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing, setFeatureSheetWidth]);

  // Portal into the SidebarInset (main card) instead of document.body
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);
  useEffect(() => {
    setPortalContainer(document.querySelector('[data-slot="sidebar-inset"]'));
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [completed, setCompleted] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [teamId, setTeamId] = useState<string | null>(null);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    } else if (open) {
      setTitle("");
      setDescription("");
      setCompleted(false);
      setStartDate(new Date());
      setEndDate(computeEndDateFromDuration(new Date(), 14));
      setTeamId(null);
      setDurationValue(2);
      setDurationUnit("weeks");
    }
  }, [feature, open]);

  /* -- Handlers -- */

  const handleSave = async () => {
    const status: MilestoneStatus = completed ? "completed" : "not_started";
    const progress = completed ? 100 : 0;

    if (isEditMode && feature && onUpdate) {
      setIsSaving(true);
      try {
        const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
        await onUpdate({
          id: feature.id,
          title,
          description: description || null,
          status,
          progress,
          duration: totalDays,
          ...(isChained ? {} : { startDate }),
          teamId,
        });
      } finally {
        setIsSaving(false);
      }
    } else if (onCreate) {
      const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
      const computedEnd = computeEndDateFromDuration(startDate, totalDays);
      onCreate({
        title,
        description: description || undefined,
        startDate,
        endDate: computedEnd,
        duration: totalDays,
        status,
        teamId,
      });
    }
  };

  const handleDelete = async () => {
    if (!feature || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(feature.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartDateChange = (date: Date) => {
    setStartDate(date);
    const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
    setEndDate(computeEndDateFromDuration(date, totalDays));
  };

  const handleDurationValueChange = (value: number) => {
    const clamped = Math.max(1, value);
    setDurationValue(clamped);
    const totalDays = clamped * DURATION_UNIT_MULTIPLIERS[durationUnit];
    setEndDate(computeEndDateFromDuration(startDate, totalDays));
  };

  const handleDurationUnitChange = (unit: DurationUnit) => {
    setDurationUnit(unit);
    const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[unit];
    setEndDate(computeEndDateFromDuration(startDate, totalDays));
  };

  const hasChanges =
    isEditMode &&
    feature &&
    (title !== feature.title ||
      description !== (feature.description || "") ||
      completed !== (feature.status === "completed") ||
      startDate.getTime() !== new Date(feature.startDate).getTime() ||
      endDate.getTime() !== new Date(feature.endDate).getTime() ||
      teamId !== feature.teamId);

  const canSubmit = isEditMode
    ? hasChanges && !!title && !isSaving
    : !!title && !isLoading && (!milestoneOptions || !!selectedMilestoneId);

  const team = teams.find((t) => t.id === teamId);

  /* ======================================================================== */
  /*  Render                                                                   */
  /* ======================================================================== */

  if (!open || !portalContainer) return null;

  return createPortal(
    <>
      {/* Full-screen overlay to capture mouse during resize */}
      {isResizing &&
        createPortal(
          <div className="fixed inset-0 z-[9999] cursor-col-resize select-none" />,
          document.body
        )}

      {/* Transparent backdrop — click to close */}
      <div
        className="absolute inset-0 z-40"
        onClick={() => { if (!isResizing) onOpenChange(false); }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={isEditMode ? "Edit Feature" : "New Feature"}
        className="absolute inset-y-0 right-0 z-50 bg-background border-l shadow-lg flex flex-col animate-in slide-in-from-right duration-300"
        style={{ width: featureSheetWidth, maxWidth: featureSheetWidth }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={resetFeatureSheetWidth}
          className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-50 group/resize flex items-center"
        >
          <div
            className={cn(
              "h-full w-[3px] rounded-xl transition-colors",
              "group-hover/resize:bg-primary/30",
              isResizing && "bg-primary/50"
            )}
          />
        </div>

        {/* ── Sticky header: breadcrumb + title ── */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/40">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {projectName && (
                <>
                  <span className="text-foreground/60">{projectName}</span>
                  <span className="text-muted-foreground/40">/</span>
                </>
              )}
              <span>{isEditMode ? "Feature" : "New Feature"}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Title input — large, ClickUp-style with hover/focus state */}
          <div className="px-6 pb-4 flex items-center gap-3">
            {/* Mark completed toggle */}
            <button
              type="button"
              onClick={() => setCompleted((c) => !c)}
              className={cn(
                "shrink-0 rounded-full transition-colors",
                completed
                  ? "text-green-500 hover:text-green-600"
                  : "text-muted-foreground/40 hover:text-muted-foreground/70",
              )}
              title={completed ? "Mark incomplete" : "Mark completed"}
            >
              {completed ? (
                <CircleCheck className="h-6 w-6" fill="currentColor" />
              ) : (
                <Circle className="h-6 w-6" />
              )}
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feature title"
              className={cn(
                "flex-1 bg-transparent text-xl font-bold placeholder:text-muted-foreground/40 outline-none rounded-md px-2 py-1 -mx-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors",
                completed
                  ? "text-muted-foreground line-through decoration-muted-foreground/50"
                  : "text-foreground",
              )}
            />
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Properties ── */}
          <div className="px-6 pt-5 pb-2">
            {/* Milestone selector (create mode, features page only) */}
            {milestoneOptions && milestoneOptions.length > 0 && (
              <PropertyRow icon={Layers3Icon} label="Milestone">
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
            <PropertyRow icon={Users} label="Team">
              <Select
                value={teamId || "none"}
                onValueChange={(v) => setTeamId(v === "none" ? null : v)}
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
            <PropertyRow icon={Timer} label="Duration">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent transition-colors"
                  >
                    {durationValue} {durationValue === 1 ? durationUnit.slice(0, -1) : durationUnit}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="flex items-center gap-2">
                    <NumberStepper
                      value={durationValue}
                      onChange={handleDurationValueChange}
                      min={1}
                      className="w-20"
                    />
                    <Select
                      value={durationUnit}
                      onValueChange={(v) =>
                        handleDurationUnitChange(v as DurationUnit)
                      }
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

            {/* Start Date */}
            <PropertyRow icon={CalendarIcon} label="Start Date">
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
                      className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent transition-colors"
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
              <div className="flex items-center gap-2 h-8 px-2">
                <span className="text-sm text-muted-foreground">
                  {format(endDate, "MMM d, yyyy")}
                </span>
                <span className="text-[11px] text-muted-foreground/40 italic">
                  computed
                </span>
              </div>
            </PropertyRow>
          </div>

          {/* ── Description — rich text editor ── */}
          <div className="px-6 pb-6">
            <div className="text-sm font-medium text-foreground/80 mb-2">Description</div>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Add a description, or type '/' for commands..."
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-3 flex items-center justify-between bg-background">
          {isEditMode && onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-8 px-2 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete feature?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{feature?.title}&quot;.
                    This action cannot be undone.
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
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={handleSave}
              disabled={!canSubmit}
            >
              {isSaving || isLoading
                ? "Saving..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Feature"}
            </Button>
          </div>
        </div>
      </div>
    </>,
    portalContainer
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline SVG icons                                                           */
/* -------------------------------------------------------------------------- */

function Layers3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    </svg>
  );
}
