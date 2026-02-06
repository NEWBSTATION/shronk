"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarIcon,
  Trash2,
  Circle,
  Clock,
  PauseCircle,
  CheckCircle2,
  XCircle,
  ArrowDown,
  Minus,
  ArrowUp,
  AlertTriangle,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/gantt/constants";
import {
  computeDurationDays,
  computeEndDateFromDuration,
  bestFitDurationUnit,
  DURATION_UNIT_MULTIPLIERS,
  type DurationUnit,
} from "@/components/gantt/transformers";
import type { Milestone, Team, MilestoneStatus, MilestonePriority } from "@/db/schema";

interface GanttFeatureSheetProps {
  feature: Milestone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  projectName: string;
}

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", icon: Circle, className: "text-slate-500" },
  { value: "in_progress", label: "In Progress", icon: Clock, className: "text-blue-500" },
  { value: "on_hold", label: "On Hold", icon: PauseCircle, className: "text-amber-500" },
  { value: "completed", label: "Completed", icon: CheckCircle2, className: "text-green-500" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, className: "text-red-400" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", icon: ArrowDown, className: "text-slate-500" },
  { value: "medium", label: "Medium", icon: Minus, className: "text-blue-500" },
  { value: "high", label: "High", icon: ArrowUp, className: "text-orange-500" },
  { value: "critical", label: "Critical", icon: AlertTriangle, className: "text-red-500" },
];

export function GanttFeatureSheet({ feature, open, onOpenChange, teams, projectName }: GanttFeatureSheetProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("not_started");
  const [priority, setPriority] = useState<MilestonePriority>("medium");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [teamId, setTeamId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");

  useEffect(() => {
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description || "");
      setStatus(feature.status);
      setPriority(feature.priority);
      const s = new Date(feature.startDate);
      const e = new Date(feature.endDate);
      setStartDate(s);
      setEndDate(e);
      setTeamId(feature.teamId);
      setProgress(feature.progress);
      const days = computeDurationDays(s, e);
      const best = bestFitDurationUnit(days);
      setDurationValue(best.value);
      setDurationUnit(best.unit);
    }
  }, [feature]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Milestone>) => {
      const response = await fetch(`/api/milestones/${feature?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate instanceof Date ? data.startDate.toISOString() : data.startDate,
          endDate: data.endDate instanceof Date ? data.endDate.toISOString() : data.endDate,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["dependencies"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/milestones/${feature?.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["dependencies"] });
      onOpenChange(false);
    },
  });

  const handleSave = () => {
    if (!feature) return;

    updateMutation.mutate({
      title,
      description: description || null,
      status,
      priority,
      startDate,
      endDate,
      teamId,
      progress,
    });
  };

  const handleStartDateChange = (date: Date) => {
    setStartDate(date);
    // Preserve duration: shift end date
    const totalDays = durationValue * DURATION_UNIT_MULTIPLIERS[durationUnit];
    const newEnd = computeEndDateFromDuration(date, totalDays);
    setEndDate(newEnd);
  };

  const handleEndDateChange = (date: Date) => {
    setEndDate(date);
    // Recompute duration from new date range
    const days = computeDurationDays(startDate, date);
    const best = bestFitDurationUnit(days);
    setDurationValue(best.value);
    setDurationUnit(best.unit);
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

  const hasChanges = feature && (
    title !== feature.title ||
    description !== (feature.description || "") ||
    status !== feature.status ||
    priority !== feature.priority ||
    startDate.getTime() !== new Date(feature.startDate).getTime() ||
    endDate.getTime() !== new Date(feature.endDate).getTime() ||
    teamId !== feature.teamId ||
    progress !== feature.progress
  );

  if (!feature) return null;

  const team = teams.find((t) => t.id === teamId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle>Feature Details</SheetTitle>
          <SheetDescription>
            Part of <span className="font-medium">{projectName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="sheet-title">Title</Label>
            <Input
              id="sheet-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Feature title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="sheet-description">Description</Label>
            <Textarea
              id="sheet-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              className="min-h-[100px] resize-none"
            />
          </div>

          <Separator />

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", option.className)} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as MilestonePriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", option.className)} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
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
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) handleEndDateChange(date);
                    }}
                    disabled={(date) => date < startDate}
                    fromDate={TIMELINE_START_DATE}
                    toDate={TIMELINE_END_DATE}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={durationValue}
                onChange={(e) => handleDurationValueChange(Number(e.target.value) || 1)}
                className="w-20"
              />
              <Select value={durationUnit} onValueChange={(v) => handleDurationUnitChange(v as DurationUnit)}>
                <SelectTrigger className="flex-1">
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
          </div>

          <Separator />

          {/* Team Assignment */}
          <div className="space-y-2">
            <Label>Team</Label>
            <Select
              value={teamId || "none"}
              onValueChange={(v) => setTeamId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No team assigned">
                  {team ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.name}
                    </div>
                  ) : (
                    "No team assigned"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No team assigned</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Slider
              value={[progress]}
              onValueChange={([v]) => setProgress(v)}
              min={0}
              max={100}
              step={5}
            />
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-2">
            <Label className="text-destructive">Danger Zone</Label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Feature
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete feature?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{feature.title}&quot;. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || !title || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
