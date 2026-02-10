"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FeatureDetailPanel } from "@/components/drilldown/panels/feature-detail-panel";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { FeaturesSectionList } from "@/components/features-list/features-section-list";
import { BulkActionBar } from "@/components/features-list/bulk-action-bar";
import { useFeaturesListStore } from "@/store/features-list-store";
import {
  useTeams,
  useDependencies,
  useUpdateMilestone,
  useDeleteMilestone,
  useReorderMilestones,
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
  teamId: string | null;
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
}

interface FeaturesResponse {
  features: Feature[];
  milestones: MilestoneOption[];
}

async function fetchFeatures(): Promise<FeaturesResponse> {
  const response = await fetch("/api/features");
  if (!response.ok) {
    throw new Error("Failed to fetch features");
  }
  return response.json();
}

export function FeaturesTab() {
  const { push, isOpen } = useDrilldown();
  const queryClient = useQueryClient();
  const clearSelection = useFeaturesListStore((s) => s.clearSelection);
  const selectMode = useFeaturesListStore((s) => s.selectMode);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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
  const reorderMutation = useReorderMilestones();

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

  const createFeatureMutation = useMutation({
    mutationFn: async (formData: {
      projectId: string;
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      status: MilestoneStatus;
    }) => {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate.toISOString(),
          endDate: formData.endDate.toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Failed to create feature");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      toast.success("Feature created");
    },
    onError: () => toast.error("Failed to create feature"),
  });

  const handleReorder = useCallback(
    ({
      projectId,
      items,
    }: {
      projectId: string;
      items: Array<{ id: string; sortOrder: number }>;
    }) => {
      // Optimistically update the allFeatures query cache
      queryClient.setQueryData(
        ["allFeatures"],
        (old: FeaturesResponse | undefined) => {
          if (!old) return old;
          const orderMap = new Map(items.map((i) => [i.id, i.sortOrder]));
          return {
            ...old,
            features: old.features
              .map((f) => ({
                ...f,
                sortOrder: orderMap.get(f.id) ?? f.sortOrder,
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          };
        }
      );

      reorderMutation.mutate(
        { projectId, items },
        {
          onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          },
        }
      );
    },
    [queryClient, reorderMutation]
  );

  const handleOpenNewFeature = useCallback(() => {
    const defaultMilestoneId = milestoneOptions[0]?.id || null;
    let currentMilestoneId = defaultMilestoneId;

    push(
      "new-feature",
      <FeatureDetailPanel
        teams={[]}
        onCreate={(formData) => {
          if (!currentMilestoneId) return;
          createFeatureMutation.mutate({
            projectId: currentMilestoneId,
            ...formData,
          });
        }}
        isLoading={createFeatureMutation.isPending}
        milestoneOptions={milestoneOptions}
        selectedMilestoneId={defaultMilestoneId}
        onMilestoneChange={(id) => {
          currentMilestoneId = id;
        }}
      />
    );
  }, [push, milestoneOptions, createFeatureMutation]);

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
      <div className="flex flex-col flex-1 min-h-0 px-4 lg:px-6 py-4 md:py-6 space-y-4">
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
      <div className="flex items-center justify-center h-64 px-4 lg:px-6 py-4 md:py-6">
        <p className="text-destructive">Failed to load features</p>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 lg:px-6 py-4 md:py-6">
        <Layers className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create a milestone first, then add features to it to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 lg:px-6 py-4 md:py-6">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-medium">Features</h1>
          {milestoneOptions.length > 0 && (
            <Button onClick={handleOpenNewFeature} className="h-7 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Feature
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <FeaturesSectionList
            features={features}
            milestones={milestoneOptions}
            onFeatureClick={handleFeatureClick}
            onReorder={handleReorder}
          />
        </div>

        <BulkActionBar />
      </div>
    </div>
  );
}
