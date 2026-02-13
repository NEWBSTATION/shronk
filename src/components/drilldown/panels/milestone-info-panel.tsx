"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, Ellipsis, Trash2 } from "lucide-react";
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
import { ColorIconPicker } from "@/components/features-list/color-icon-picker";
import { MilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";
import { useDrilldown } from "@/components/drilldown/drilldown-context";

interface MilestoneInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string | null;
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
      toast.success("Milestone deleted");
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
    <div className="p-8">
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-6">
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
      <div className="mb-8">
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

      {/* Description */}
      <RichTextEditor
        content={milestone.description || ""}
        onChange={handleDescriptionSave}
      />

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
  );
}
