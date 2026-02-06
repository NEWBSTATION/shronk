"use client";

import { useEffect, useState } from "react";
import { addDays, addWeeks, addMonths, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { statusConfig } from "@/components/shared/status-badge";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/gantt/constants";
import type { Milestone, Team, MilestoneStatus } from "@/db/schema";

type DurationUnit = "days" | "weeks" | "months";

interface MilestoneOption {
  id: string;
  name: string;
}

interface FeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: Milestone | null;
  teams: Team[];
  onSave: (data: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    duration?: number;
    status: MilestoneStatus;
    teamId?: string | null;
  }) => void;
  isLoading?: boolean;
  // Optional milestone selection props (for creating features from features page)
  milestoneOptions?: MilestoneOption[];
  selectedMilestoneId?: string | null;
  onMilestoneChange?: (id: string | null) => void;
}

export function FeatureDialog({
  open,
  onOpenChange,
  feature,
  teams,
  onSave,
  isLoading,
  milestoneOptions,
  selectedMilestoneId,
  onMilestoneChange,
}: FeatureDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [status, setStatus] = useState<MilestoneStatus>("not_started");
  const [teamId, setTeamId] = useState<string | null>(null);

  // Duration mode state
  const [dateInputMode, setDateInputMode] = useState<"range" | "duration">(
    "range"
  );
  const [durationValue, setDurationValue] = useState(2);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("weeks");

  // Calculate end date from duration
  const calculateEndDate = (
    start: Date,
    value: number,
    unit: DurationUnit
  ): Date => {
    switch (unit) {
      case "days":
        return addDays(start, value - 1); // -1 because start day counts
      case "weeks":
        return addDays(start, value * 7 - 1);
      case "months":
        return addDays(addMonths(start, value), -1);
      default:
        return start;
    }
  };

  // Update end date when duration changes
  useEffect(() => {
    if (dateInputMode === "duration") {
      const newEndDate = calculateEndDate(
        startDate,
        durationValue,
        durationUnit
      );
      setEndDate(newEndDate);
    }
  }, [dateInputMode, startDate, durationValue, durationUnit]);

  // Calculate duration from date range (for display)
  const getDurationDisplay = () => {
    const days = differenceInDays(endDate, startDate) + 1;
    if (days % 7 === 0 && days >= 7) {
      return `${days / 7} week${days / 7 !== 1 ? "s" : ""}`;
    }
    return `${days} day${days !== 1 ? "s" : ""}`;
  };

  useEffect(() => {
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description || "");
      setStartDate(new Date(feature.startDate));
      setEndDate(new Date(feature.endDate));
      setStatus(feature.status);
      setTeamId(feature.teamId);
      setDateInputMode("range");
    } else {
      setTitle("");
      setDescription("");
      setStartDate(new Date());
      setEndDate(addWeeks(new Date(), 2));
      setStatus("not_started");
      setTeamId(null);
      setDateInputMode("duration");
      setDurationValue(2);
      setDurationUnit("weeks");
    }
  }, [feature, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = differenceInDays(endDate, startDate) + 1;
    onSave({
      title,
      description: description || undefined,
      startDate,
      endDate,
      duration: Math.max(1, duration),
      status,
      teamId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {feature ? "Edit Feature" : "Add Feature"}
            </DialogTitle>
            <DialogDescription>
              {feature
                ? "Update the feature details below."
                : "Fill in the details to add a new feature."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Milestone Selection (only shown when milestoneOptions is provided) */}
            {milestoneOptions && milestoneOptions.length > 0 && (
              <div className="grid gap-2">
                <Label>Milestone</Label>
                <Select
                  value={selectedMilestoneId || ""}
                  onValueChange={(v) => onMilestoneChange?.(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    {milestoneOptions.map((milestone) => (
                      <SelectItem key={milestone.id} value={milestone.id}>
                        {milestone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Feature title"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="resize-none min-h-[80px]"
              />
            </div>

            {/* Date Input - Tabbed */}
            <div className="grid gap-2">
              <Label>Timeline</Label>
              <Tabs
                value={dateInputMode}
                onValueChange={(v) =>
                  setDateInputMode(v as "range" | "duration")
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="range">Date Range</TabsTrigger>
                  <TabsTrigger value="duration">Start + Duration</TabsTrigger>
                </TabsList>

                <TabsContent value="range" className="mt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Start Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate
                              ? format(startDate, "MMM d, yyyy")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => {
                              if (date) {
                                setStartDate(date);
                                if (date > endDate) {
                                  setEndDate(date);
                                }
                              }
                            }}
                            fromDate={TIMELINE_START_DATE}
                            toDate={TIMELINE_END_DATE}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">
                        End Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate
                              ? format(endDate, "MMM d, yyyy")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => date && setEndDate(date)}
                            disabled={(date) => date < startDate}
                            fromDate={TIMELINE_START_DATE}
                            toDate={TIMELINE_END_DATE}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Duration: {getDurationDisplay()}
                  </p>
                </TabsContent>

                <TabsContent value="duration" className="mt-3">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Start Date
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate
                              ? format(startDate, "MMM d, yyyy")
                              : "Pick a date"}
                          </Button>
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
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Duration
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          value={durationValue}
                          onChange={(e) =>
                            setDurationValue(
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          className="w-20"
                        />
                        <Select
                          value={durationUnit}
                          onValueChange={(v) =>
                            setDurationUnit(v as DurationUnit)
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="weeks">Weeks</SelectItem>
                            <SelectItem value="months">Months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Ends: {format(endDate, "MMM d, yyyy")}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as MilestoneStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center">
                          <Icon className="mr-2 h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            {teams.length > 0 && (
              <div className="grid gap-2">
                <Label>Team</Label>
                <Select
                  value={teamId || "none"}
                  onValueChange={(v) => setTeamId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center">
                          <span
                            className="mr-2 h-3 w-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title || isLoading || (milestoneOptions && !selectedMilestoneId)}>
              {isLoading ? "Saving..." : feature ? "Save Changes" : "Add Feature"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
