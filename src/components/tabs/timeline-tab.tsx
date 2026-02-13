"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { ChartGantt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FeatureDetailPanel, type PanelChainTo } from "@/components/drilldown/panels/feature-detail-panel";
import { MilestoneInfoPanel } from "@/components/drilldown/panels/milestone-info-panel";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { topoSortFeatures } from "@/lib/topo-sort";
import {
  useProjects,
  useMilestones,
  useTeams,
  useDependencies,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useCreateDependency,
  useDeleteDependency,
  useUpsertTeamDuration,
  useDeleteTeamDuration,
  useReorderFeatures,
} from "@/hooks/use-milestones";
import type { CascadedUpdate } from "@/hooks/use-milestones";
import type { Milestone, MilestoneStatus, Project } from "@/db/schema";

const SVARTimelineView = dynamic(
  () =>
    import("@/components/timeline/timeline-view").then((m) => m.TimelineView),
  { ssr: false, loading: () => <TimelineSkeleton /> }
);

const ROW_HEIGHT = 52;
const SCALE_HEIGHT = 56;
const SKELETON_ROWS = 6;

// Deterministic pseudo-random widths for skeleton task bars
const BAR_CONFIGS = [
  { left: "32%", width: "45%" },
  { left: "18%", width: "30%" },
  { left: "45%", width: "35%" },
  { left: "10%", width: "55%" },
  { left: "38%", width: "25%" },
  { left: "22%", width: "40%" },
];

function TimelineSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-[100px] rounded-md" />
          <div className="h-4 w-px bg-border" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
        <Skeleton className="h-5 w-20 rounded" />
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 flex">
        {/* Left column — feature names */}
        <div className="w-[200px] shrink-0 border-r border-border">
          {/* Scale header spacer */}
          <div style={{ height: SCALE_HEIGHT * 2 }} className="border-b border-border bg-muted/20" />
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 border-b border-border/50"
              style={{ height: ROW_HEIGHT }}
            >
              <Skeleton className="h-3.5 flex-1 rounded" />
              <Skeleton className="h-4 w-8 rounded" />
            </div>
          ))}
        </div>

        {/* Right chart area — scale headers + task bars */}
        <div className="flex-1 min-w-0">
          {/* Scale headers */}
          <div className="border-b border-border bg-muted/20" style={{ height: SCALE_HEIGHT }}>
            <div className="flex h-full items-end px-2 gap-16 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-16 rounded" />
              ))}
            </div>
          </div>
          <div className="border-b border-border bg-muted/10" style={{ height: SCALE_HEIGHT }}>
            <div className="flex h-full items-end px-2 gap-8 pb-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-2.5 w-8 rounded" />
              ))}
            </div>
          </div>

          {/* Task bar rows */}
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => {
            const config = BAR_CONFIGS[i % BAR_CONFIGS.length];
            return (
              <div
                key={i}
                className="relative border-b border-border/50"
                style={{ height: ROW_HEIGHT }}
              >
                <Skeleton
                  className="absolute top-3 h-7 rounded-md"
                  style={{ left: config.left, width: config.width }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TimelineTabProps {
  initialMilestoneId?: string | null;
  isActive?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Panel state for the right-side detail overlay                              */
/* -------------------------------------------------------------------------- */

type PanelContent =
  | { mode: "edit"; feature: Milestone }
  | { mode: "create"; chain?: boolean }
  | { mode: "milestone"; project: Project };

export function TimelineTab({ initialMilestoneId, isActive = true }: TimelineTabProps) {
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = projectsData?.projects ?? [];

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<
    string | null
  >(initialMilestoneId ?? null);

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

  // Local side panel state (not the global drilldown)
  const [panelContent, setPanelContent] = useState<PanelContent | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const panelTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  const openPanel = useCallback((content: PanelContent) => {
    clearTimeout(panelTimerRef.current);
    setPanelContent(content);
    // Slight delay so the DOM renders before transition starts
    requestAnimationFrame(() => setPanelVisible(true));
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
    panelTimerRef.current = setTimeout(() => {
      setPanelContent(null);
    }, 300);
  }, []);

  // Close panel immediately when tab becomes inactive
  useEffect(() => {
    if (!isActive && panelContent) {
      clearTimeout(panelTimerRef.current);
      setPanelVisible(false);
      setPanelContent(null);
    }
  }, [isActive, panelContent]);

  // Close panel on Escape
  useEffect(() => {
    if (!panelContent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelContent, closePanel]);

  // Close panel on click outside
  useEffect(() => {
    if (!panelVisible) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the panel itself
      if (panelRef.current && panelRef.current.contains(target)) return;
      // Don't close if clicking inside Radix portals (Select, Popover, DropdownMenu, Dialog, etc.)
      if (target.closest("[data-radix-popper-content-wrapper], [role='dialog'], [data-radix-select-viewport], [data-radix-menu-content]")) return;
      closePanel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelVisible, closePanel]);

  // Auto-select first milestone when projects load and nothing is selected
  useEffect(() => {
    if (!selectedMilestoneId && projects.length > 0) {
      setSelectedMilestoneId(projects[0].id);
    }
  }, [projects, selectedMilestoneId]);

  const selectedMilestone = projects.find((p) => p.id === selectedMilestoneId);

  const { data: featuresData } = useMilestones({
    projectId: selectedMilestoneId || "",
    sortField: "sortOrder",
    sortDirection: "asc",
  });
  const features = useMemo(
    () => featuresData?.milestones ?? [],
    [featuresData?.milestones]
  );
  const teamDurations = useMemo(
    () => featuresData?.teamDurations ?? [],
    [featuresData?.teamDurations]
  );

  const { data: teamsData } = useTeams();
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const { data: depsData } = useDependencies(selectedMilestoneId || "");
  const dependencies = useMemo(
    () => depsData?.dependencies ?? [],
    [depsData?.dependencies]
  );

  // Chain info: last feature in topo-sorted order for chain-to behavior
  const panelChainTo = useMemo((): PanelChainTo | null => {
    if (features.length === 0) return null;
    const sorted = topoSortFeatures(features, dependencies);
    const last = sorted[sorted.length - 1];
    return {
      featureId: last.id,
      featureTitle: last.title,
      endDate: new Date(last.endDate),
    };
  }, [features, dependencies]);

  const createFeatureMutation = useCreateMilestone();
  const updateFeatureMutation = useUpdateMilestone();
  const deleteFeatureMutation = useDeleteMilestone();
  const createDependencyMutation = useCreateDependency();
  const deleteDependencyMutation = useDeleteDependency();
  const upsertTeamDurationMutation = useUpsertTeamDuration();
  const deleteTeamDurationMutation = useDeleteTeamDuration();
  const reorderMutation = useReorderFeatures();

  const handleEditFeature = useCallback(
    (feature: Milestone) => {
      openPanel({ mode: "edit", feature });
    },
    [openPanel]
  );

  const handleAddFeature = useCallback((opts?: { chain?: boolean }) => {
    openPanel({ mode: "create", chain: !!opts?.chain });
  }, [openPanel]);

  const handleMilestoneClick = useCallback(
    (project: Project) => {
      openPanel({ mode: "milestone", project });
    },
    [openPanel]
  );

  const handleAddMilestone = useCallback(() => {
    setMilestoneDialogOpen(true);
  }, []);

  const handleMilestoneCreated = useCallback((projectId: string) => {
    setSelectedMilestoneId(projectId);
  }, []);

  const handleUpdateFeature = useCallback(
    async (data: Partial<Milestone> & { id: string; duration?: number }) => {
      try {
        await updateFeatureMutation.mutateAsync(data);
        toast.success("Feature updated");
      } catch {
        toast.error("Failed to update feature");
      }
    },
    [updateFeatureMutation]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      try {
        await deleteFeatureMutation.mutateAsync(id);
        closePanel();
        toast.success("Feature deleted");
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteFeatureMutation, closePanel]
  );

  const queryClient = useQueryClient();

  const milestoneOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects]
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
        queryClient.invalidateQueries({ queryKey: ["milestones"] });
        queryClient.invalidateQueries({ queryKey: ["dependencies"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        closePanel();
        toast.success("Feature moved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move feature");
      }
    },
    [queryClient, closePanel]
  );

  const handleDeleteFeatureFromTimeline = useCallback(
    async (id: string) => {
      try {
        await deleteFeatureMutation.mutateAsync(id);
        toast.success("Feature deleted");
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteFeatureMutation]
  );

  const handleUpdateDates = useCallback(
    async (
      id: string,
      startDate: Date,
      endDate: Date,
      duration?: number
    ): Promise<CascadedUpdate[]> => {
      try {
        const result = await updateFeatureMutation.mutateAsync({
          id,
          startDate,
          endDate,
          duration:
            duration ?? Math.max(0, differenceInDays(endDate, startDate) + 1),
        });
        return result.cascadedUpdates || [];
      } catch {
        toast.error("Failed to update dates");
        return [];
      }
    },
    [updateFeatureMutation]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: MilestoneStatus) => {
      try {
        await updateFeatureMutation.mutateAsync({ id, status });
        toast.success("Status updated");
      } catch {
        toast.error("Failed to update status");
      }
    },
    [updateFeatureMutation]
  );

  const handleCreateDependency = useCallback(
    async (predecessorId: string, successorId: string) => {
      try {
        await createDependencyMutation.mutateAsync({
          predecessorId,
          successorId,
        });
      } catch {
        toast.error("Failed to create dependency");
      }
    },
    [createDependencyMutation]
  );

  const handleDeleteDependency = useCallback(
    async (id: string) => {
      try {
        await deleteDependencyMutation.mutateAsync(id);
      } catch {
        toast.error("Failed to delete dependency");
      }
    },
    [deleteDependencyMutation]
  );

  const handleUpdateTeamDuration = useCallback(
    async (milestoneId: string, teamId: string, duration: number) => {
      try {
        await upsertTeamDurationMutation.mutateAsync({
          milestoneId,
          teamId,
          duration,
        });
      } catch {
        toast.error("Failed to update team duration");
      }
    },
    [upsertTeamDurationMutation]
  );

  const handleQuickCreate = useCallback(
    async (name: string, startDate: Date, endDate: Date, duration: number, chainToId?: string) => {
      if (!selectedMilestoneId) return;
      try {
        const newFeature = await createFeatureMutation.mutateAsync({
          projectId: selectedMilestoneId,
          title: name,
          startDate,
          endDate,
          duration,
          status: 'not_started',
          sortOrder: features.length,
        });
        if (chainToId) {
          await createDependencyMutation.mutateAsync({
            predecessorId: chainToId,
            successorId: newFeature.id,
          });
          toast.success("Feature created & chained");
        } else {
          toast.success("Feature created");
        }
      } catch {
        toast.error("Failed to create feature");
      }
    },
    [selectedMilestoneId, createFeatureMutation, createDependencyMutation, features.length]
  );

  const handleDeleteTeamDuration = useCallback(
    async (milestoneId: string, teamId: string) => {
      try {
        await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });
        toast.success("Team track removed");
      } catch {
        toast.error("Failed to remove team track");
      }
    },
    [deleteTeamDurationMutation]
  );

  const handleReorderFeatures = useCallback(
    async (projectId: string, orderedFeatureIds: string[]) => {
      try {
        await reorderMutation.mutateAsync({ projectId, orderedFeatureIds });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reorder features");
      }
    },
    [reorderMutation]
  );

  // Loading state — show skeleton while projects are being fetched
  if (isLoadingProjects) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0">
          <div className="flex items-center gap-1">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-28 ml-auto rounded-md" />
        </div>
        <div className="min-h-0 flex-1 p-6">
          <div className="h-full flex flex-col">
            <TimelineSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // No milestones at all
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
        <ChartGantt className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No milestones yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create a milestone first to view its timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Timeline chart */}
      {selectedMilestone && (
        <div className="min-h-0 flex-1 p-6">
          <div className="h-full flex flex-col">
            <SVARTimelineView
              key={selectedMilestone.id}
              project={selectedMilestone}
              allProjects={projects}
              onProjectChange={setSelectedMilestoneId}
              features={features}
              dependencies={dependencies}
              teams={teams}
              teamDurations={teamDurations}
              onBack={() => setSelectedMilestoneId(null)}
              onEdit={handleEditFeature}
              onDelete={handleDeleteFeatureFromTimeline}
              onUpdateDates={handleUpdateDates}
              onUpdateTeamDuration={handleUpdateTeamDuration}
              onStatusChange={handleStatusChange}
              onAddFeature={handleAddFeature}
              onQuickCreate={handleQuickCreate}
              onCreateDependency={handleCreateDependency}
              onDeleteDependency={handleDeleteDependency}
              onReorderFeatures={handleReorderFeatures}
              onMilestoneClick={handleMilestoneClick}
              onAddMilestone={handleAddMilestone}
            />
          </div>
        </div>
      )}

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        onCreated={handleMilestoneCreated}
      />

      {/* Right-side detail panel — floating island within timeline bounds */}
      {panelContent && (
        <div
          ref={panelRef}
          className={cn(
            "feature-island-panel absolute top-10 bottom-10 right-10 z-50 w-[calc(100%-2.5rem)] md:w-[480px] min-w-[320px] max-w-[calc(100%-5rem)] overflow-hidden bg-background rounded-2xl border border-border shadow-[0_8px_40px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-300 ease-out",
            panelVisible
              ? "translate-x-0 opacity-100"
              : "translate-x-8 opacity-0 pointer-events-none"
          )}
        >
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {panelContent.mode === "milestone" ? (
              <MilestoneInfoPanel
                milestone={panelContent.project}
                onBack={closePanel}
              />
            ) : panelContent.mode === "edit" ? (
              <FeatureDetailPanel
                feature={panelContent.feature}
                teams={teams}
                projectName={selectedMilestone?.name}
                dependencies={dependencies}
                teamDurations={teamDurations}
                milestoneOptions={milestoneOptions}
                selectedMilestoneId={panelContent.feature.projectId}
                onMilestoneChange={(targetId) => {
                  if (targetId && targetId !== panelContent.feature.projectId) {
                    handleMoveFeature(panelContent.feature.id, targetId);
                  }
                }}
                onUpdate={handleUpdateFeature}
                onDelete={handleDeleteFeature}
                onUpsertTeamDuration={handleUpdateTeamDuration}
                onDeleteTeamDuration={handleDeleteTeamDuration}
                onBack={closePanel}
              />
            ) : (
              <FeatureDetailPanel
                teams={teams}
                projectName={selectedMilestone?.name}
                onBack={closePanel}
                chainTo={panelChainTo}
                chainEnabled={panelContent.mode === "create" && !!panelContent.chain}
                onCreate={async (formData) => {
                  if (!selectedMilestoneId) return;
                  const { teamTracks, chainToId, ...milestoneData } = formData;
                  try {
                    const newMilestone = await createFeatureMutation.mutateAsync({
                      projectId: selectedMilestoneId,
                      ...milestoneData,
                    });
                    if (chainToId) {
                      await createDependencyMutation.mutateAsync({
                        predecessorId: chainToId,
                        successorId: newMilestone.id,
                      });
                    }
                    if (teamTracks && teamTracks.length > 0) {
                      await Promise.all(
                        teamTracks.map((tt) =>
                          upsertTeamDurationMutation.mutateAsync({
                            milestoneId: newMilestone.id,
                            teamId: tt.teamId,
                            duration: tt.duration,
                          })
                        )
                      );
                    }
                    toast.success(chainToId ? "Feature created & chained" : "Feature added");
                  } catch {
                    toast.error("Failed to add feature");
                  }
                }}
                isLoading={createFeatureMutation.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
