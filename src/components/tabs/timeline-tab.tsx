"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { ChartGantt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FeatureDetailPanel } from "@/components/drilldown/panels/feature-detail-panel";
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
} from "@/hooks/use-milestones";
import type { CascadedUpdate } from "@/hooks/use-milestones";
import type { Milestone, MilestoneStatus } from "@/db/schema";

const SVARTimelineView = dynamic(
  () =>
    import("@/components/timeline/svar-timeline-view").then((m) => m.SVARTimelineView),
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
}

/* -------------------------------------------------------------------------- */
/*  Panel state for the right-side detail overlay                              */
/* -------------------------------------------------------------------------- */

type PanelContent =
  | { mode: "edit"; feature: Milestone }
  | { mode: "create" };

export function TimelineTab({ initialMilestoneId }: TimelineTabProps) {
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = projectsData?.projects ?? [];

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<
    string | null
  >(initialMilestoneId ?? null);

  // Local side panel state (not the global drilldown)
  const [panelContent, setPanelContent] = useState<PanelContent | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const panelTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // Close panel on Escape
  useEffect(() => {
    if (!panelContent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelContent, closePanel]);

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

  const { data: teamsData } = useTeams(selectedMilestoneId || "");
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const { data: depsData } = useDependencies(selectedMilestoneId || "");
  const dependencies = useMemo(
    () => depsData?.dependencies ?? [],
    [depsData?.dependencies]
  );

  const createFeatureMutation = useCreateMilestone();
  const updateFeatureMutation = useUpdateMilestone();
  const deleteFeatureMutation = useDeleteMilestone();
  const createDependencyMutation = useCreateDependency();
  const deleteDependencyMutation = useDeleteDependency();

  const handleEditFeature = useCallback(
    (feature: Milestone) => {
      openPanel({ mode: "edit", feature });
    },
    [openPanel]
  );

  const handleAddFeature = useCallback(() => {
    openPanel({ mode: "create" });
  }, [openPanel]);

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
            duration ?? Math.max(1, differenceInDays(endDate, startDate) + 1),
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
              project={selectedMilestone}
              allProjects={projects}
              onProjectChange={setSelectedMilestoneId}
              features={features}
              dependencies={dependencies}
              teams={teams}
              onBack={() => setSelectedMilestoneId(null)}
              onEdit={handleEditFeature}
              onDelete={handleDeleteFeatureFromTimeline}
              onUpdateDates={handleUpdateDates}
              onStatusChange={handleStatusChange}
              onAddFeature={handleAddFeature}
              onCreateDependency={handleCreateDependency}
              onDeleteDependency={handleDeleteDependency}
            />
          </div>
        </div>
      )}

      {/* Right-side detail panel overlay */}
      {panelContent && (
        <>
          {/* Scrim — click to close */}
          <div
            className={cn(
              "absolute inset-0 z-40 bg-black/20 transition-opacity duration-300",
              panelVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={closePanel}
          />

          {/* Panel */}
          <div
            className={cn(
              "absolute inset-y-0 right-0 z-50 w-full md:w-[480px] bg-background border-l shadow-lg overflow-y-auto transition-transform duration-300 ease-out",
              panelVisible ? "translate-x-0" : "translate-x-full"
            )}
          >
            {panelContent.mode === "edit" ? (
              <FeatureDetailPanel
                feature={panelContent.feature}
                teams={teams}
                projectName={selectedMilestone?.name}
                dependencies={dependencies}
                onUpdate={handleUpdateFeature}
                onDelete={handleDeleteFeature}
                onBack={closePanel}
              />
            ) : (
              <FeatureDetailPanel
                teams={teams}
                projectName={selectedMilestone?.name}
                onBack={closePanel}
                onCreate={(formData) => {
                  if (!selectedMilestoneId) return;
                  createFeatureMutation.mutate(
                    { projectId: selectedMilestoneId, ...formData },
                    {
                      onSuccess: () => {
                        toast.success("Feature added");
                      },
                      onError: () => toast.error("Failed to add feature"),
                    }
                  );
                }}
                isLoading={createFeatureMutation.isPending}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
