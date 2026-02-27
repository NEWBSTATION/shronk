"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Search, SlidersHorizontal, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { FeatureDialog, type ChainTo } from "@/components/feature/feature-dialog";
import { BulkActionBar } from "@/components/features-list/bulk-action-bar";
import { useFeaturesListStore } from "@/store/features-list-store";
import {
  useTeams,
  useDependencies,
  useUpdateMilestone,
  useDeleteMilestone,
  useCreateMilestone,
  useCreateDependency,
  useDeleteDependency,
  useReorderFeatures,
  useUpsertTeamDuration,
  useDeleteTeamDuration,
} from "@/hooks/use-milestones";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { describeUpdate } from "@/lib/undo-descriptions";
import type { Milestone, MilestoneStatus } from "@/db/schema";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
  priority: "none" | "low" | "medium" | "high" | "critical";
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

interface TeamDurationEntry {
  id: string;
  milestoneId: string;
  teamId: string;
  duration: number;
  startDate: string;
  endDate: string;
}

interface TeamEntry {
  id: string;
  name: string;
  color: string;
}

export interface TeamDurationInfo {
  teamId: string;
  teamName: string;
  teamColor: string;
  duration: number;
}

interface FeaturesResponse {
  features: Feature[];
  milestones: MilestoneOption[];
  dependencies: FeaturesDepEntry[];
  teamDurations: TeamDurationEntry[];
  teams: TeamEntry[];
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
  const durationUnit = useFeaturesListStore((s) => s.durationUnit);
  const setDurationUnit = useFeaturesListStore((s) => s.setDurationUnit);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featureDialogMilestoneId, setFeatureDialogMilestoneId] = useState<string | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [chainTo, setChainTo] = useState<ChainTo | null>(null);
  const [chainEnabled, setChainEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["allFeatures"],
    queryFn: fetchFeatures,
  });

  const features = data?.features || [];
  const milestoneOptions = data?.milestones || [];

  // Compute matching feature IDs for search (null = no search active)
  const searchMatchIds = useMemo((): Set<string> | null => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(features.filter((f) => f.title.toLowerCase().includes(q)).map((f) => f.id));
  }, [features, searchQuery]);

  // Milestone IDs that contain at least one matching feature
  const searchMatchMilestoneIds = useMemo((): Set<string> | null => {
    if (!searchMatchIds) return null;
    const ids = new Set<string>();
    for (const f of features) {
      if (searchMatchIds.has(f.id)) ids.add(f.projectId);
    }
    return ids;
  }, [searchMatchIds, features]);

  // Build per-feature team duration map for display in feature rows
  const teamDurationsMap = useMemo(() => {
    if (!data?.teamDurations || !data?.teams) return new Map<string, TeamDurationInfo[]>();
    const teamsById = new Map(data.teams.map((t) => [t.id, t]));
    const map = new Map<string, TeamDurationInfo[]>();
    for (const td of data.teamDurations) {
      const team = teamsById.get(td.teamId);
      if (!team) continue;
      const arr = map.get(td.milestoneId) ?? [];
      arr.push({
        teamId: td.teamId,
        teamName: team.name,
        teamColor: team.color,
        duration: td.duration,
      });
      map.set(td.milestoneId, arr);
    }
    return map;
  }, [data?.teamDurations, data?.teams]);

  const { data: teamsData } = useTeams();
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const { data: depsData } = useDependencies(activeProjectId || "");
  const dependencies = useMemo(() => depsData?.dependencies ?? [], [depsData?.dependencies]);

  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();
  const createMutation = useCreateMilestone();
  const createDepMutation = useCreateDependency();
  const deleteDepMutation = useDeleteDependency();
  const reorderMutation = useReorderFeatures();
  const upsertTeamDurationMutation = useUpsertTeamDuration();
  const deleteTeamDurationMutation = useDeleteTeamDuration();
  const showUndoToast = useUndoToast();

  const handleUpdateFeature = useCallback(
    async (updateData: Partial<Milestone> & { id: string; duration?: number }, options?: { silent?: boolean }) => {
      // Snapshot old values for undo
      const feature = features.find((f) => f.id === updateData.id);
      const oldValues: Record<string, unknown> = {};
      if (feature) {
        for (const key of Object.keys(updateData)) {
          if (key !== "id" && key in feature) {
            oldValues[key] = feature[key as keyof Feature];
          }
        }
      }

      try {
        await updateMutation.mutateAsync(updateData);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });

        const desc = describeUpdate(updateData, feature?.title);
        showUndoToast({
          description: desc,
          silent: options?.silent,
          undo: async () => {
            await updateMutation.mutateAsync({ id: updateData.id, ...oldValues } as Partial<Milestone> & { id: string });
            queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          },
        });
      } catch {
        toast.error("Failed to update feature");
      }
    },
    [updateMutation, queryClient, features, showUndoToast]
  );

  /** Silent version for inline detail-panel edits (no toast) */
  const handleUpdateFeatureSilent = useCallback(
    (data: Partial<Milestone> & { id: string; duration?: number }) =>
      handleUpdateFeature(data, { silent: true }),
    [handleUpdateFeature]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      const feature = data?.features.find((f) => f.id === id);
      // Snapshot deps and team durations for reconstruction
      const featureDeps = (data?.dependencies ?? []).filter(
        (d) => d.predecessorId === id || d.successorId === id
      );
      const featureTeamDurations = (data?.teamDurations ?? []).filter(
        (td) => td.milestoneId === id
      );

      try {
        await deleteMutation.mutateAsync(id);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });

        if (feature) {
          showUndoToast({
            description: `"${feature.title}" deleted`,
            undo: async () => {
              // Recreate the feature
              const newFeature = await createMutation.mutateAsync({
                projectId: feature.projectId,
                title: feature.title,
                description: feature.description ?? undefined,
                startDate: feature.startDate,
                endDate: feature.endDate,
                duration: feature.duration,
                status: feature.status,
                priority: feature.priority,
                progress: feature.progress,
                sortOrder: feature.sortOrder,
              });
              // Recreate dependencies (with new feature ID)
              for (const dep of featureDeps) {
                const predId = dep.predecessorId === id ? newFeature.id : dep.predecessorId;
                const succId = dep.successorId === id ? newFeature.id : dep.successorId;
                try {
                  await createDepMutation.mutateAsync({ predecessorId: predId, successorId: succId });
                } catch { /* dep target may no longer exist */ }
              }
              // Recreate team durations
              for (const td of featureTeamDurations) {
                try {
                  await upsertTeamDurationMutation.mutateAsync({
                    milestoneId: newFeature.id,
                    teamId: td.teamId,
                    duration: td.duration,
                  });
                } catch { /* team may no longer exist */ }
              }
              queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
            },
          });
        }
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteMutation, queryClient, data?.features, data?.dependencies, data?.teamDurations, showUndoToast, createMutation, createDepMutation, upsertTeamDurationMutation]
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
    async (featureId: string, targetProjectId: string, insertAtIndex?: number) => {
      const feature = features.find((f) => f.id === featureId);
      const oldProjectId = feature?.projectId;
      const oldMilestoneName = feature ? milestoneOptions.find((m) => m.id === feature.projectId)?.name : undefined;
      const newMilestoneName = milestoneOptions.find((m) => m.id === targetProjectId)?.name;

      try {
        const response = await fetch("/api/features/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureId, targetProjectId, insertAtIndex }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to move feature");
        }
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        queryClient.invalidateQueries({ queryKey: ["milestones"] });
        queryClient.invalidateQueries({ queryKey: ["dependencies"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });

        if (oldProjectId) {
          showUndoToast({
            description: `"${feature?.title}" moved to ${newMilestoneName ?? "milestone"}`,
            undo: async () => {
              const res = await fetch("/api/features/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featureId, targetProjectId: oldProjectId }),
              });
              if (!res.ok) throw new Error("Failed to undo move");
              queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
              queryClient.invalidateQueries({ queryKey: ["milestones"] });
              queryClient.invalidateQueries({ queryKey: ["dependencies"] });
              queryClient.invalidateQueries({ queryKey: ["projects"] });
            },
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move feature");
      }
    },
    [queryClient, features, milestoneOptions, showUndoToast]
  );

  const handleReorderFeatures = useCallback(
    async (projectId: string, orderedFeatureIds: string[]) => {
      // Snapshot current order for undo
      const oldOrder = features
        .filter((f) => f.projectId === projectId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => f.id);

      try {
        await reorderMutation.mutateAsync({ projectId, orderedFeatureIds });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });

        showUndoToast({
          description: "Features reordered",
          undo: async () => {
            await reorderMutation.mutateAsync({ projectId, orderedFeatureIds: oldOrder });
            queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reorder features");
      }
    },
    [reorderMutation, queryClient, features, showUndoToast]
  );

  const handleUpsertTeamDuration = useCallback(
    async (milestoneId: string, teamId: string, duration: number) => {
      // Snapshot old team duration (if it existed)
      const oldTd = (data?.teamDurations ?? []).find(
        (td) => td.milestoneId === milestoneId && td.teamId === teamId
      );
      const hadOld = !!oldTd;
      const oldDuration = oldTd?.duration;

      try {
        await upsertTeamDurationMutation.mutateAsync({ milestoneId, teamId, duration });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });

        showUndoToast({
          description: hadOld ? "Team duration updated" : "Team track added",
          undo: async () => {
            if (hadOld && oldDuration !== undefined) {
              await upsertTeamDurationMutation.mutateAsync({ milestoneId, teamId, duration: oldDuration });
            } else {
              await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });
            }
            queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          },
        });
      } catch {
        toast.error("Failed to update team duration");
      }
    },
    [upsertTeamDurationMutation, deleteTeamDurationMutation, queryClient, data?.teamDurations, showUndoToast]
  );

  const handleDeleteTeamDuration = useCallback(
    async (milestoneId: string, teamId: string) => {
      // Snapshot old duration for undo
      const oldTd = (data?.teamDurations ?? []).find(
        (td) => td.milestoneId === milestoneId && td.teamId === teamId
      );

      try {
        await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });

        showUndoToast({
          description: "Team track removed",
          undo: async () => {
            if (oldTd) {
              await upsertTeamDurationMutation.mutateAsync({
                milestoneId,
                teamId,
                duration: oldTd.duration,
              });
            }
            queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
          },
        });
      } catch {
        toast.error("Failed to remove team track");
      }
    },
    [deleteTeamDurationMutation, upsertTeamDurationMutation, queryClient, data?.teamDurations, showUndoToast]
  );

  const handleAddFeatureForMilestone = useCallback(
    (milestoneId: string, e?: React.MouseEvent) => {
      setFeatureDialogMilestoneId(milestoneId);

      // Find the last feature in this milestone for chaining
      const milestoneFeatures = features.filter((f) => f.projectId === milestoneId);
      const lastFeature = milestoneFeatures.length > 0
        ? milestoneFeatures[milestoneFeatures.length - 1]
        : null;

      if (lastFeature) {
        setChainTo({
          featureId: lastFeature.id,
          featureTitle: lastFeature.title,
          endDate: lastFeature.endDate,
        });
        setChainEnabled(!!e?.shiftKey);
      } else {
        setChainTo(null);
        setChainEnabled(false);
      }

      setFeatureDialogOpen(true);
    },
    [features]
  );

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

  const deletingMilestoneNameRef = useRef<string | null>(null);
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      deletingMilestoneNameRef.current = milestoneOptions.find((m) => m.id === id)?.name ?? null;
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
      toast.success("Milestone deleted", { description: deletingMilestoneNameRef.current ?? undefined });
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

  const handleStatusChange = useCallback(
    (featureId: string, newStatus: string) => {
      handleUpdateFeature({
        id: featureId,
        status: newStatus as MilestoneStatus,
        progress: newStatus === "completed" ? 100 : 0,
      });
    },
    [handleUpdateFeature]
  );

  const handlePriorityChange = useCallback(
    (featureId: string, newPriority: string) => {
      handleUpdateFeature({
        id: featureId,
        priority: newPriority as Feature["priority"],
      });
    },
    [handleUpdateFeature]
  );

  const handleRenameFeature = useCallback(
    (featureId: string, newTitle: string) => {
      handleUpdateFeature({ id: featureId, title: newTitle });
    },
    [handleUpdateFeature]
  );

  const handleDurationChange = useCallback(
    (featureId: string, newDurationDays: number) => {
      handleUpdateFeature({ id: featureId, duration: newDurationDays });
    },
    [handleUpdateFeature]
  );

  const handleRenameMilestone = useCallback(
    async (milestoneId: string, newName: string) => {
      try {
        const response = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: milestoneId, name: newName }),
        });
        if (!response.ok) throw new Error("Failed to rename milestone");
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      } catch {
        toast.error("Failed to rename milestone");
      }
    },
    [queryClient]
  );

  const handleCreateDep = useCallback(
    async (predecessorId: string, successorId: string) => {
      try {
        await createDepMutation.mutateAsync({ predecessorId, successorId });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch {
        toast.error("Failed to create dependency");
      }
    },
    [createDepMutation, queryClient]
  );

  const handleDeleteDep = useCallback(
    async (depId: string) => {
      try {
        await deleteDepMutation.mutateAsync(depId);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch {
        toast.error("Failed to delete dependency");
      }
    },
    [deleteDepMutation, queryClient]
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
          teamDurations={data?.teamDurations as any}
          onUpdate={handleUpdateFeatureSilent}
          onDelete={handleDeleteFeature}
          onUpsertTeamDuration={handleUpsertTeamDuration}
          onDeleteTeamDuration={handleDeleteTeamDuration}
          onCreateDependency={handleCreateDep}
          onDeleteDependency={handleDeleteDep}
          milestoneOptions={milestoneOptions}
          selectedMilestoneId={feature.projectId}
          onMilestoneChange={(targetId) => {
            if (targetId && targetId !== feature.projectId) {
              handleMoveFeature(feature.id, targetId);
            }
          }}
        />
      );
    },
    [push, teams, dependencies, data?.teamDurations, handleUpdateFeatureSilent, handleDeleteFeature, handleUpsertTeamDuration, handleDeleteTeamDuration, handleCreateDep, handleDeleteDep]
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

  // Cmd+K / Ctrl+K focuses the search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // F / Shift+F — add feature (defaults to first milestone)
  // M — new milestone
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        const firstMilestone = milestoneOptions[0];
        if (firstMilestone) {
          handleAddFeatureForMilestone(firstMilestone.id, { shiftKey: e.shiftKey } as React.MouseEvent);
        }
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setMilestoneDialogOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [milestoneOptions, handleAddFeatureForMilestone]);

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl pt-6 md:pt-8">
          {/* Search bar */}
          <Skeleton className="h-9 w-full rounded-md mb-3" />

          {/* Milestone sections */}
          {[0, 1].map((s) => (
            <div key={s} className="mb-3 last:mb-0">
              {/* Section header */}
              <div className="flex items-center gap-1.5 px-3 py-2.5">
                <Skeleton className="h-6 w-6 rounded shrink-0" />
                <Skeleton className="h-4 w-28" />
                <div className="flex-1" />
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full hidden sm:block" />
                <Skeleton className="h-3.5 w-3.5 rounded" />
              </div>
              {/* Feature rows */}
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 h-11 border-b border-border/40">
                  <Skeleton className="h-[18px] w-[18px] rounded-full shrink-0" />
                  <Skeleton className="h-4 w-[45%] min-w-0" />
                  <div className="flex-1" />
                  <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                  <Skeleton className="h-5 w-7 rounded-full shrink-0 hidden sm:block" />
                  <Skeleton className="h-4 w-8 shrink-0" />
                </div>
              ))}
            </div>
          ))}
        </div>
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
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
          <Layers className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Create a milestone first, then add features to it to see them here.
          </p>
          <Button className="mt-4" onClick={() => setMilestoneDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Milestone
          </Button>
        </div>
        <MilestoneDialog
          open={milestoneDialogOpen}
          onOpenChange={setMilestoneDialogOpen}
          onOpenMilestone={(id) => {
            const m = queryClient.getQueryData<FeaturesResponse>(["allFeatures"])?.milestones.find((m) => m.id === id);
            if (m) push(`milestone-info-${id}`, <MilestoneInfoPanel milestone={m} />);
          }}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 overflow-y-auto [scrollbar-gutter:stable] [mask-image:linear-gradient(to_bottom,transparent,black_16px)]">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl flex flex-col min-h-0 pt-6 md:pt-8">
        {/* Search input + display settings */}
        {(features.length > 0 || milestoneOptions.length > 0) && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-transparent dark:bg-transparent"
              />
              {searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground pointer-events-none">
                  ⌘K
                </kbd>
              )}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative shrink-0 h-9 w-9 bg-background dark:bg-background text-muted-foreground hover:text-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                  {durationUnit !== "days" && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end" sideOffset={4}>
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Duration unit</p>
                {(["days", "weeks", "months", "years"] as const).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setDurationUnit(unit)}
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors capitalize ${
                      durationUnit === unit
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}

        {searchMatchIds && searchMatchIds.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No features matching &quot;{searchQuery.trim()}&quot;
            </p>
          </div>
        ) : (
        <FeaturesSectionList
          features={features}
          milestones={milestoneOptions}
          dependencies={data?.dependencies}
          teamDurationsMap={teamDurationsMap}
          allTeams={teams}
          searchMatchIds={searchMatchIds}
          searchMatchMilestoneIds={searchMatchMilestoneIds}
          onFeatureClick={handleFeatureClick}
          onToggleComplete={handleToggleComplete}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onAddFeature={handleAddFeatureForMilestone}
          onEditMilestone={handleEditMilestone}
          onDeleteMilestone={handleDeleteMilestone}
          onUpdateAppearance={handleUpdateAppearance}
          onAddMilestone={() => setMilestoneDialogOpen(true)}
          onMoveFeature={handleMoveFeature}
          onReorderFeatures={handleReorderFeatures}
          onRenameMilestone={handleRenameMilestone}
          onRenameFeature={handleRenameFeature}
          onDurationChange={handleDurationChange}
          onAddTeamTrack={(featureId, teamId) => {
            const feature = features.find((f) => f.id === featureId);
            handleUpsertTeamDuration(featureId, teamId, feature?.duration ?? 14);
          }}
          onRemoveTeamTrack={handleDeleteTeamDuration}
          onDeleteFeature={handleDeleteFeature}
        />
        )}

        <BulkActionBar />
      </div>

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        onOpenMilestone={(id) => {
          const m = queryClient.getQueryData<FeaturesResponse>(["allFeatures"])?.milestones.find((m) => m.id === id);
          if (m) push(`milestone-info-${id}`, <MilestoneInfoPanel milestone={m} />);
        }}
      />

      <FeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        milestones={milestoneOptions}
        defaultMilestoneId={featureDialogMilestoneId}
        teams={teams}
        chainTo={chainTo}
        chainEnabled={chainEnabled}
        onOpenFeature={(id) => {
          const features = queryClient.getQueryData<FeaturesResponse>(["allFeatures"])?.features;
          const feature = features?.find((f) => f.id === id);
          if (feature) handleFeatureClick(feature);
        }}
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
