"use client";

import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDrilldown } from "./drilldown-context";
import { FeatureDetailPanel } from "./panels/feature-detail-panel";
import {
  useTeams,
  useDependencies,
  useUpdateMilestone,
  useDeleteMilestone,
  useUpsertTeamDuration,
  useDeleteTeamDuration,
  useProjects,
} from "@/hooks/use-milestones";
import type { Milestone } from "@/db/schema";

interface FeaturesResponse {
  features: Array<{
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    status: string;
    priority: string;
    progress: number;
    duration: number;
    sortOrder: number;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    milestoneName: string;
    milestoneColor: string;
    milestoneIcon: string;
  }>;
  milestones: Array<{ id: string; name: string; color: string; icon: string }>;
  dependencies: Array<{
    id: string;
    predecessorId: string;
    successorId: string;
  }>;
  teamDurations: Array<{
    id: string;
    milestoneId: string;
    teamId: string;
    duration: number;
    startDate: string;
    endDate: string;
  }>;
  teams: Array<{ id: string; name: string; color: string }>;
}

/**
 * Self-contained feature detail panel that fetches all its own data.
 * Used by DrilldownRestorer to re-open a feature panel after page refresh.
 */
export function RestoredFeaturePanel({ featureId }: { featureId: string }) {
  const queryClient = useQueryClient();

  const { data } = useQuery<FeaturesResponse>({
    queryKey: ["allFeatures"],
    queryFn: async () => {
      const res = await fetch("/api/features");
      if (!res.ok) throw new Error("Failed to fetch features");
      return res.json();
    },
  });

  const feature = useMemo(
    () => data?.features.find((f) => f.id === featureId),
    [data?.features, featureId],
  );

  const { data: teamsData } = useTeams();
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const projectId = feature?.projectId ?? "";
  const { data: depsData } = useDependencies(projectId);
  const dependencies = useMemo(
    () => depsData?.dependencies ?? [],
    [depsData?.dependencies],
  );

  const { data: projectsData } = useProjects();
  const milestoneOptions = useMemo(
    () =>
      (projectsData?.projects ?? []).map((p) => ({ id: p.id, name: p.name })),
    [projectsData?.projects],
  );

  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();
  const upsertTeamDurationMutation = useUpsertTeamDuration();
  const deleteTeamDurationMutation = useDeleteTeamDuration();

  const handleUpdate = useCallback(
    async (updateData: Partial<Milestone> & { id: string }) => {
      try {
        await updateMutation.mutateAsync(updateData);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch {
        toast.error("Failed to update feature");
      }
    },
    [updateMutation, queryClient],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        toast.success("Feature deleted");
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteMutation, queryClient],
  );

  const handleUpsertTeamDuration = useCallback(
    async (milestoneId: string, teamId: string, duration: number) => {
      try {
        await upsertTeamDurationMutation.mutateAsync({
          milestoneId,
          teamId,
          duration,
        });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch {
        toast.error("Failed to update team duration");
      }
    },
    [upsertTeamDurationMutation, queryClient],
  );

  const handleDeleteTeamDuration = useCallback(
    async (milestoneId: string, teamId: string) => {
      try {
        await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch {
        toast.error("Failed to remove team track");
      }
    },
    [deleteTeamDurationMutation, queryClient],
  );

  const handleMoveFeature = useCallback(
    async (fId: string, targetProjectId: string) => {
      try {
        const response = await fetch("/api/features/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureId: fId, targetProjectId }),
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
        toast.error(
          err instanceof Error ? err.message : "Failed to move feature",
        );
      }
    },
    [queryClient],
  );

  if (!feature) {
    return <PanelSkeleton />;
  }

  return (
    <FeatureDetailPanel
      feature={feature as unknown as Milestone}
      teams={teams}
      projectName={feature.milestoneName}
      dependencies={dependencies}
      teamDurations={data?.teamDurations as any}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      onUpsertTeamDuration={handleUpsertTeamDuration}
      onDeleteTeamDuration={handleDeleteTeamDuration}
      milestoneOptions={milestoneOptions}
      selectedMilestoneId={feature.projectId}
      onMilestoneChange={(targetId) => {
        if (targetId && targetId !== feature.projectId) {
          handleMoveFeature(feature.id, targetId);
        }
      }}
    />
  );
}

/** Shimmer skeleton matching the feature detail panel layout */
function PanelSkeleton() {
  const { pop } = useDrilldown();
  return (
    <div className="min-w-0 animate-pulse">
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-4">
        {/* Back button */}
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={pop}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        {/* Title */}
        <div className="h-7 w-3/4 bg-muted rounded mb-6" />
        {/* Properties */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-5 w-32 bg-muted rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-5 w-28 bg-muted rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-5 w-20 bg-muted rounded" />
          </div>
        </div>
        {/* Description */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="h-5 w-28 bg-muted rounded mb-3" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-5/6 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
