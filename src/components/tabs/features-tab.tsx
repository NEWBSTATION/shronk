"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Search, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useReorderFeatures,
  useUpsertTeamDuration,
  useDeleteTeamDuration,
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
  const reorderMutation = useReorderFeatures();
  const upsertTeamDurationMutation = useUpsertTeamDuration();
  const deleteTeamDurationMutation = useDeleteTeamDuration();

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

  const handleReorderFeatures = useCallback(
    async (projectId: string, orderedFeatureIds: string[]) => {
      try {
        await reorderMutation.mutateAsync({ projectId, orderedFeatureIds });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reorder features");
      }
    },
    [reorderMutation, queryClient]
  );

  const handleUpsertTeamDuration = useCallback(
    async (milestoneId: string, teamId: string, duration: number) => {
      try {
        await upsertTeamDurationMutation.mutateAsync({ milestoneId, teamId, duration });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      } catch {
        toast.error("Failed to update team duration");
      }
    },
    [upsertTeamDurationMutation, queryClient]
  );

  const handleDeleteTeamDuration = useCallback(
    async (milestoneId: string, teamId: string) => {
      try {
        await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        toast.success("Team track removed");
      } catch {
        toast.error("Failed to remove team track");
      }
    },
    [deleteTeamDurationMutation, queryClient]
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

  // React to create intent from the header plus button
  const prevIntent = useRef(createIntent);
  useEffect(() => {
    if (createIntent > 0 && createIntent !== prevIntent.current) {
      prevIntent.current = createIntent;
      if (createType === "milestone") {
        setMilestoneDialogOpen(true);
      } else {
        setFeatureDialogMilestoneId(null);
        setChainTo(null);
        setChainEnabled(false);
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
          onUpdate={handleUpdateFeature}
          onDelete={handleDeleteFeature}
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
    },
    [push, teams, dependencies, data?.teamDurations, handleUpdateFeature, handleDeleteFeature, handleUpsertTeamDuration, handleDeleteTeamDuration]
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

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 px-6 py-8">
        <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
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
        />
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_16px)]">
      <div className="mx-auto w-full max-w-xl lg:max-w-2xl xl:max-w-4xl flex flex-col min-h-0 pt-8 pb-32">
        {/* Search input */}
        {(features.length > 0 || milestoneOptions.length > 0) && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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
          searchMatchIds={searchMatchIds}
          searchMatchMilestoneIds={searchMatchMilestoneIds}
          onFeatureClick={handleFeatureClick}
          onToggleComplete={handleToggleComplete}
          onStatusChange={handleStatusChange}
          onAddFeature={handleAddFeatureForMilestone}
          onEditMilestone={handleEditMilestone}
          onDeleteMilestone={handleDeleteMilestone}
          onUpdateAppearance={handleUpdateAppearance}
          onAddMilestone={() => setMilestoneDialogOpen(true)}
          onMoveFeature={handleMoveFeature}
          onReorderFeatures={handleReorderFeatures}
        />
        )}

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
        teams={teams}
        chainTo={chainTo}
        chainEnabled={chainEnabled}
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
