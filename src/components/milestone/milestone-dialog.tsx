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
  DialogTitle,
} from "@/components/ui/dialog";
import { PropertyRow } from "@/components/ui/property-row";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { toast } from "sonner";
import { TIMELINE_START_DATE, TIMELINE_END_DATE } from "@/components/timeline/constants";

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
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName("");
    setStartDate(new Date());
    setEndDate(addMonths(new Date(), 3));
    setDescription("");
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
          ...(description.trim() ? { description: description.trim() } : {}),
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

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[500px] gap-0" showCloseButton={false}>
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Milestone name..."
            className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none outline-none placeholder:text-ring rounded-md px-2 pt-0.5 pb-1 -ml-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors"
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

        {/* Description */}
        <div className="mt-4 pt-4 border-t border-border max-h-[240px] overflow-y-auto">
          <RichTextEditor
            content={description}
            onChange={setDescription}
            saveStatus="idle"
          />
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
