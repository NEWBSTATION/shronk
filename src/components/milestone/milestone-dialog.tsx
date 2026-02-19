"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { PropertyRow } from "@/components/ui/property-row";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";
import { getMilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";

interface MilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: string) => void;
  /** Called when toast "Open" is clicked — receives created milestone ID */
  onOpenMilestone?: (id: string) => void;
}

export function MilestoneDialog({ open, onOpenChange, onCreated, onOpenMilestone }: MilestoneDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addMonths(new Date(), 3));

  const resetForm = () => {
    setName("");
    setStartDate(new Date());
    setEndDate(addMonths(new Date(), 3));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          icon: "rocket",
          color: "blue",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create milestone");
      }

      const created = await response.json();
      const milestoneId = created.id;
      const milestoneName = name.trim();
      toast.success("Milestone created", {
        description: milestoneName,
        ...(onOpenMilestone ? { action: { label: "Open", onClick: () => onOpenMilestone(milestoneId) } } : {}),
      });
      onOpenChange(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestoneStats"] });
      onCreated?.(created.id);
    } catch (err) {
      setError((err as Error).message || "Failed to create milestone");
    } finally {
      setIsLoading(false);
    }
  };

  const IconComponent = getMilestoneIcon("rocket");
  const colorStyles = getColorStyles("blue");

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[500px] gap-0">
        <DialogTitle className="sr-only">New Milestone</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new milestone to organize your features.
        </DialogDescription>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="mb-4">
          <div
            className="size-12 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: colorStyles.iconBg }}
          >
            <IconComponent className="size-7" style={{ color: colorStyles.hex }} />
          </div>
        </div>

        <div className="mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Milestone name..."
            className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                handleSubmit();
              }
            }}
          />
        </div>

        <div className="space-y-0.5">
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
                  onSelect={(date) => {
                    if (date) {
                      setStartDate(date);
                      if (date > endDate) setEndDate(date);
                    }
                  }}
                  fromDate={TIMELINE_START_DATE}
                  toDate={TIMELINE_END_DATE}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </PropertyRow>

          <PropertyRow icon={Clock} label="End date" type="custom">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center h-8 px-2 text-sm rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  {format(endDate, "MMM d, yyyy")}
                </button>
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
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? "Creating..." : "Create Milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
