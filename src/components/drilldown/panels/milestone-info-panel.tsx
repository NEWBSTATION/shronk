"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Ellipsis, Trash2, CalendarIcon, Clock, ChevronUp, ChevronDown, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { PropertyRow } from "@/components/ui/property-row";
import { ColorIconPicker } from "@/components/features-list/color-icon-picker";
import { MilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";
import { cn } from "@/lib/utils";
import { useDrilldown } from "@/components/drilldown/drilldown-context";

interface MilestoneInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

interface MilestoneInfoPanelProps {
  milestone: MilestoneInfo;
  /** Override the default back/close behavior (defaults to drilldown pop) */
  onBack?: () => void;
}

export function MilestoneInfoPanel({ milestone, onBack }: MilestoneInfoPanelProps) {
  const { pop } = useDrilldown();
  const handleBack = onBack ?? pop;
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; color?: string; icon?: string; description?: string | null }) => {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestoneStats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestoneStats"] });
      toast.success("Milestone deleted", { description: milestone.name });
      pop();
    },
    onError: () => toast.error("Failed to delete milestone"),
  });

  const handleColorChange = useCallback(
    (color: string) => updateMutation.mutate({ id: milestone.id, color }),
    [updateMutation, milestone.id]
  );

  const handleIconChange = useCallback(
    (icon: string) => updateMutation.mutate({ id: milestone.id, icon }),
    [updateMutation, milestone.id]
  );

  const handleNameSave = useCallback(
    (name: string) => updateMutation.mutate({ id: milestone.id, name }),
    [updateMutation, milestone.id]
  );

  const handleDescriptionSave = useCallback(
    (description: string) =>
      updateMutation.mutate({ id: milestone.id, description: description || null }),
    [updateMutation, milestone.id]
  );

  const colorStyles = getColorStyles(milestone.color);

  return (
    <div>
      <div ref={sentinelRef} className="h-0" />
      {/* Sticky header — icon + title stick to top on scroll */}
      <div className="sticky top-0 z-10 bg-background px-8 pt-8 pb-4 relative">
        <div className={cn(
          "absolute bottom-0 left-8 right-8 h-px transition-colors",
          isStuck ? "bg-border" : "bg-transparent"
        )} />
        <div className={cn(
          "absolute top-full left-0 right-0 h-4 pointer-events-none transition-opacity bg-gradient-to-b from-background to-transparent",
          isStuck ? "opacity-100" : "opacity-0"
        )} />
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete milestone
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Icon + Name */}
        <div className="flex items-center gap-3">
          <ColorIconPicker
            color={milestone.color}
            icon={milestone.icon}
            onColorChange={handleColorChange}
            onIconChange={handleIconChange}
          >
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:opacity-80"
              style={{
                backgroundColor: colorStyles.iconBg,
                color: colorStyles.hex,
              }}
            >
              <MilestoneIcon name={milestone.icon} className="h-5 w-5" />
            </button>
          </ColorIconPicker>
          <input
            key={milestone.name}
            defaultValue={milestone.name}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== milestone.name) handleNameSave(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="flex-1 min-w-0 bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 outline-none rounded-md px-2 pt-0.5 pb-1 -ml-2 hover:bg-accent/40 focus:bg-accent/50 transition-colors text-foreground overflow-hidden text-ellipsis"
            placeholder="Milestone name..."
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="px-8 pb-8">

      {/* Properties */}
      <div className="space-y-0.5">
        {!(hideEmptyProps && !milestone.startDate) && (
          <PropertyRow icon={CalendarIcon} label="Start Date" type="custom">
            <div className="flex items-center h-8 px-2">
              <span className="text-sm text-muted-foreground">
                {milestone.startDate
                  ? format(new Date(milestone.startDate), "MMM d, yyyy")
                  : "—"}
              </span>
            </div>
          </PropertyRow>
        )}
        {!(hideEmptyProps && !milestone.endDate) && (
          <PropertyRow icon={Clock} label="End Date" type="custom">
            <div className="flex items-center h-8 px-2">
              <span className="text-sm text-muted-foreground">
                {milestone.endDate
                  ? format(new Date(milestone.endDate), "MMM d, yyyy")
                  : "—"}
              </span>
            </div>
          </PropertyRow>
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

      {/* Description */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2 -mx-2">
          <AlignLeft className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Description</span>
        </div>
        <RichTextEditor
          content={milestone.description || ""}
          onChange={handleDescriptionSave}
        />
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{milestone.name}&rdquo; and all
              its features. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(milestone.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
