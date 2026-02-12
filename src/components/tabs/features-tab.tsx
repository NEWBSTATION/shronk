"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureDetailPanel } from "@/components/drilldown/panels/feature-detail-panel";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { FeaturesSectionList } from "@/components/features-list/features-section-list";
import { MilestoneInfoPanel } from "@/components/drilldown/panels/milestone-info-panel";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { FeatureDialog } from "@/components/feature/feature-dialog";
import { BulkActionBar } from "@/components/features-list/bulk-action-bar";
import { useFeaturesListStore } from "@/store/features-list-store";
import {
  useTeams,
  useDependencies,
  useUpdateMilestone,
  useDeleteMilestone,
} from "@/hooks/use-milestones";
import type { Milestone, MilestoneStatus } from "@/db/schema";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;
  duration: number;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestoneName: string;
  milestoneColor: string;
  milestoneIcon: string;
}

interface MilestoneOption {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string | null;
}

interface FeaturesDepEntry {
  id: string;
  predecessorId: string;
  successorId: string;
}

interface FeaturesResponse {
  features: Feature[];
  milestones: MilestoneOption[];
  dependencies: FeaturesDepEntry[];
}

async function fetchFeatures(): Promise<FeaturesResponse> {
  const response = await fetch("/api/features");
  if (!response.ok) {
    throw new Error("Failed to fetch features");
  }
  return response.json();
}

export function FeaturesTab({ createIntent = 0, createType = "feature" }: { createIntent?: number; createType?: "milestone" | "feature" }) {
  const { push, isOpen } = useDrilldown();
  const queryClient = useQueryClient();
  const clearSelection = useFeaturesListStore((s) => s.clearSelection);
  const selectMode = useFeaturesListStore((s) => s.selectMode);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featureDialogMilestoneId, setFeatureDialogMilestoneId] = useState<string | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["allFeatures"],
    queryFn: fetchFeatures,
  });

  const features = data?.features || [];
  const milestoneOptions = data?.milestones || [];

  const { data: teamsData } = useTeams(activeProjectId || "");
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const { data: depsData } = useDependencies(activeProjectId || "");
  const dependencies = useMemo(() => depsData?.dependencies ?? [], [depsData?.dependencies]);

  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

  const handleUpdateFeature = useCallback(
    async (data: Partial<Milestone> & { id: string; duration?: number }) => {
      try {
        await updateMutation.mutateAsync(data);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        toast.success("Feature updated");
      } catch {
        toast.error("Failed to update feature");
      }
    },
    [updateMutation, queryClient]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        toast.success("Feature deleted");
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteMutation, queryClient]
  );

  const handleUpdateAppearance = useCallback(
    async (milestoneId: string, data: { color: string; icon: string }) => {
      try {
        const response = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: milestoneId, ...data }),
        });
        if (!response.ok) throw new Error("Failed to update milestone");
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      } catch {
        toast.error("Failed to update milestone appearance");
      }
    },
    [queryClient]
  );

  const handleMoveFeature = useCallback(
    async (featureId: string, targetProjectId: string) => {
      try {
        const response = await fetch("/api/features/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureId, targetProjectId }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to move feature");
        }
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        queryClient.invalidateQueries({ queryKey: ["milestones"] });
        queryClient.invalidateQueries({ queryKey: ["dependencies"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        toast.success("Feature moved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move feature");
      }
    },
    [queryClient]
  );

  const handleAddFeatureForMilestone = useCallback(
    (milestoneId: string) => {
      setFeatureDialogMilestoneId(milestoneId);
      setFeatureDialogOpen(true);
    },
    []
  );

  // React to create intent from the header plus button
  const prevIntent = useRef(createIntent);
  useEffect(() => {
    if (createIntent > 0 && createIntent !== prevIntent.current) {
      prevIntent.current = createIntent;
      if (createType === "milestone") {
        setMilestoneDialogOpen(true);
      } else {
        setFeatureDialogMilestoneId(null);
        setFeatureDialogOpen(true);
      }
    }
  }, [createIntent, createType, milestoneOptions, handleAddFeatureForMilestone]);

  const handleEditMilestone = useCallback(
    (milestoneId: string) => {
      const m = milestoneOptions.find((m) => m.id === milestoneId);
      if (!m) return;
      // Find description from a feature's extra data or pass what we have
      push(
        `milestone-info-${milestoneId}`,
        <MilestoneInfoPanel milestone={m} />
      );
    },
    [push, milestoneOptions]
  );

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Failed to delete milestone");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["milestoneStats"] });
      toast.success("Milestone deleted");
    },
    onError: () => toast.error("Failed to delete milestone"),
  });

  const handleDeleteMilestone = useCallback(
    (milestoneId: string) => {
      setDeletingMilestoneId(milestoneId);
    },
    []
  );

  const confirmDeleteMilestone = useCallback(() => {
    if (deletingMilestoneId) {
      deleteProjectMutation.mutate(deletingMilestoneId);
      setDeletingMilestoneId(null);
    }
  }, [deletingMilestoneId, deleteProjectMutation]);

  const handleToggleComplete = useCallback(
    (featureId: string, currentStatus: string) => {
      const newStatus: MilestoneStatus = currentStatus === "completed" ? "not_started" : "completed";
      handleUpdateFeature({ id: featureId, status: newStatus, progress: newStatus === "completed" ? 100 : 0 });
    },
    [handleUpdateFeature]
  );

  const handleFeatureClick = useCallback(
    (feature: Feature) => {
      setActiveProjectId(feature.projectId);
      push(
        `feature-${feature.id}`,
        <FeatureDetailPanel
          feature={feature as unknown as Milestone}
          teams={teams}
          projectName={feature.milestoneName}
          dependencies={dependencies}
          onUpdate={handleUpdateFeature}
          onDelete={handleDeleteFeature}
        />
      );
    },
    [push, teams, dependencies, handleUpdateFeature, handleDeleteFeature]
  );

  // Escape key exits select mode (only when drilldown is not open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectMode && !isOpen) {
        clearSelection();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectMode, isOpen, clearSelection]);

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 px-6 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 px-6 py-8">
        <p className="text-destructive">Failed to load features</p>
      </div>
    );
  }

  if (features.length === 0 && milestoneOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
        <Layers className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create a milestone first, then add features to it to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 py-8">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <FeaturesSectionList
            features={features}
            milestones={milestoneOptions}
            dependencies={data?.dependencies}
            onFeatureClick={handleFeatureClick}
            onToggleComplete={handleToggleComplete}
            onAddFeature={handleAddFeatureForMilestone}
            onEditMilestone={handleEditMilestone}
            onDeleteMilestone={handleDeleteMilestone}
            onUpdateAppearance={handleUpdateAppearance}
            onAddMilestone={() => setMilestoneDialogOpen(true)}
            onMoveFeature={handleMoveFeature}
          />
        </div>

        <BulkActionBar />
      </div>

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
      />

      <FeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        milestones={milestoneOptions}
        defaultMilestoneId={featureDialogMilestoneId}
      />

      <AlertDialog
        open={!!deletingMilestoneId}
        onOpenChange={(open) => { if (!open) setDeletingMilestoneId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{milestoneOptions.find((m) => m.id === deletingMilestoneId)?.name}&quot; and all its features. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMilestone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
