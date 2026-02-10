"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Timer, Layers3 } from "lucide-react";
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

interface FeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: MilestoneOption[];
  /** Pre-select a milestone when opening */
  defaultMilestoneId?: string | null;
}

export function FeatureDialog({
  open,
  onOpenChange,
  milestones,
  defaultMilestoneId,
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

      toast.success("Feature created");
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
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
