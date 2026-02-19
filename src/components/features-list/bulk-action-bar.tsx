"use client";

import { X, Trash2 } from "lucide-react";
import { priorityConfig } from "@/components/shared/status-badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  useBulkUpdateMilestones,
  useBulkDeleteMilestones,
} from "@/hooks/use-milestones";
import { useFeaturesListStore } from "@/store/features-list-store";
import { useQueryClient } from "@tanstack/react-query";

export function BulkActionBar() {
  const { selectedIds, clearSelection } = useFeaturesListStore();
  const queryClient = useQueryClient();
  const bulkUpdate = useBulkUpdateMilestones();
  const bulkDelete = useBulkDeleteMilestones();

  const count = selectedIds.size;
  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const handleStatusChange = (status: string) => {
    bulkUpdate.mutate(
      {
        ids,
        updates: {
          status: status as "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled",
          ...(status === "completed" ? { progress: 100 } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${count} feature(s) updated`);
          queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          clearSelection();
        },
        onError: () => toast.error("Failed to update features"),
      }
    );
  };

  const handlePriorityChange = (priority: string) => {
    bulkUpdate.mutate(
      {
        ids,
        updates: {
          priority: priority as "none" | "low" | "medium" | "high" | "critical",
        },
      },
      {
        onSuccess: () => {
          toast.success(`${count} feature(s) updated`);
          queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          clearSelection();
        },
        onError: () => toast.error("Failed to update features"),
      }
    );
  };

  const handleDelete = () => {
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        toast.success(`${count} feature(s) deleted`);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        clearSelection();
      },
      onError: () => toast.error("Failed to delete features"),
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
      <span className="text-sm font-medium tabular-nums mr-1">
        {count} selected
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={clearSelection}
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      <div className="h-5 w-px bg-border mx-1" />

      <Select onValueChange={handleStatusChange}>
        <SelectTrigger className="h-7 w-auto text-xs gap-1 border-none shadow-none">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="not_started">Not Started</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={handlePriorityChange}>
        <SelectTrigger className="h-7 w-auto text-xs gap-1 border-none shadow-none">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(priorityConfig).filter(([key]) => key !== "none").map(([key, config]) => {
            const Icon = config.icon;
            return (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <div className="h-5 w-px bg-border mx-1" />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} feature(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected features will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
