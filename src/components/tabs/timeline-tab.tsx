"use client";

import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { ChartGantt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { FeatureDetailPanel, type PanelChainTo } from "@/components/drilldown/panels/feature-detail-panel";
import { MilestoneInfoPanel } from "@/components/drilldown/panels/milestone-info-panel";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { useFeatureContextMenu } from "@/components/shared/feature-context-menu";
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
  useUpdateDependencyLag,
  useTightenGaps,
} from "@/hooks/use-milestones";
import type { CascadedUpdate } from "@/hooks/use-milestones";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { describeUpdate } from "@/lib/undo-descriptions";
import type { Milestone, MilestoneStatus, Project } from "@/db/schema";

const DynamicTimelineView = dynamic(
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

/** Read persisted timeline settings synchronously to avoid layout shift */
function getPersistedTimelineSettings() {
  if (typeof window === "undefined") return { gridColumnWidth: 200, sidebarCollapsed: false };
  try {
    const raw = localStorage.getItem("shronk-timeline-storage");
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      return {
        gridColumnWidth: typeof state.gridColumnWidth === "number" ? state.gridColumnWidth : 200,
        sidebarCollapsed: typeof state.sidebarCollapsed === "boolean" ? state.sidebarCollapsed : false,
      };
    }
  } catch { /* ignore */ }
  return { gridColumnWidth: 200, sidebarCollapsed: false };
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function TimelineSkeleton() {
  const [ready, setReady] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Read persisted settings and reveal in one batched update — the skeleton
  // stays invisible (opacity 0) until we know the correct layout, then appears
  // at the right width with no flash.
  useIsomorphicLayoutEffect(() => {
    const settings = getPersistedTimelineSettings();
    setSidebarWidth(settings.gridColumnWidth);
    setSidebarCollapsed(settings.sidebarCollapsed);
    setReady(true);
  }, []);

  const sidebarOpen = !sidebarCollapsed;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden"
      style={{ opacity: ready ? 1 : 0 }}
    >
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-10 sm:w-16 rounded-md" />
          <Skeleton className="h-6 w-12 sm:w-[100px] rounded-md" />
          <div className="h-4 w-px bg-border hidden sm:block" />
          <Skeleton className="h-6 w-6 rounded-md hidden sm:block" />
        </div>
        <Skeleton className="h-5 w-16 sm:w-20 rounded" />
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 flex">
        {/* Left column — feature names (CSS hides on mobile, JS handles collapsed) */}
        {sidebarOpen && (
          <div
            className="shrink-0 border-r border-border hidden md:block"
            style={{ width: sidebarWidth }}
          >
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
        )}

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
  selectedMilestoneId: string | null;
  onMilestoneChange: (id: string | null) => void;
  isActive?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Panel state for the right-side detail overlay                              */
/* -------------------------------------------------------------------------- */

type PanelContent =
  | { mode: "edit"; feature: Milestone }
  | { mode: "create"; chain?: boolean }
  | { mode: "milestone"; project: Project };

export function TimelineTab({ selectedMilestoneId, onMilestoneChange: setSelectedMilestoneId, isActive = true }: TimelineTabProps) {
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = projectsData?.projects ?? [];

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

  // Close panel on Escape (let Radix handle its own overlays first)
  useEffect(() => {
    if (!panelContent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector("[data-radix-popper-content-wrapper], [role='dialog'], [role='listbox'], [data-radix-menu-content]")) return;
        closePanel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelContent, closePanel]);

  // Close panel on click outside
  const overlayOpenRef = useRef(false);
  const overlayCooldownRef = useRef(false);

  useEffect(() => {
    if (!panelVisible) {
      overlayOpenRef.current = false;
      overlayCooldownRef.current = false;
      return;
    }

    const OVERLAY_SELECTOR = "[data-radix-popper-content-wrapper], [role='dialog'], [role='listbox'], [data-radix-menu-content]";
    let cooldownTimer: ReturnType<typeof setTimeout>;

    // Track Radix overlay open/close via MutationObserver so we never
    // race against Radix tearing down its portals before our handler runs.
    const observer = new MutationObserver(() => {
      const hasOverlay = !!document.querySelector(OVERLAY_SELECTOR);
      if (overlayOpenRef.current && !hasOverlay) {
        overlayCooldownRef.current = true;
        clearTimeout(cooldownTimer);
        cooldownTimer = setTimeout(() => {
          overlayCooldownRef.current = false;
        }, 100);
      }
      overlayOpenRef.current = hasOverlay;
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (target.closest(OVERLAY_SELECTOR)) return;
      if (overlayOpenRef.current || overlayCooldownRef.current) return;
      closePanel();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => {
      document.removeEventListener("pointerdown", handler, true);
      observer.disconnect();
      clearTimeout(cooldownTimer);
    };
  }, [panelVisible, closePanel]);

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
  const updateDependencyLagMutation = useUpdateDependencyLag();
  const tightenGapsMutation = useTightenGaps();
  const showUndoToast = useUndoToast();

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
    async (updateData: Partial<Milestone> & { id: string; duration?: number }, options?: { silent?: boolean }) => {
      const feature = features.find((f) => f.id === updateData.id);
      const oldValues: Record<string, unknown> = {};
      if (feature) {
        for (const key of Object.keys(updateData)) {
          if (key !== "id" && key in feature) {
            oldValues[key] = feature[key as keyof Milestone];
          }
        }
      }

      try {
        await updateFeatureMutation.mutateAsync(updateData);

        const desc = describeUpdate(updateData, feature?.title);
        showUndoToast({
          description: desc,
          silent: options?.silent,
          undo: async () => {
            await updateFeatureMutation.mutateAsync({ id: updateData.id, ...oldValues } as Partial<Milestone> & { id: string });
          },
        });
      } catch {
        toast.error("Failed to update feature");
      }
    },
    [updateFeatureMutation, features, showUndoToast]
  );

  const handleUpdateFeatureSilent = useCallback(
    (data: Partial<Milestone> & { id: string; duration?: number }) =>
      handleUpdateFeature(data, { silent: true }),
    [handleUpdateFeature]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      const feature = features.find((f) => f.id === id);
      const featureDeps = dependencies.filter(
        (d) => d.predecessorId === id || d.successorId === id
      );
      const featureTeamDurs = teamDurations.filter((td) => td.milestoneId === id);

      try {
        await deleteFeatureMutation.mutateAsync(id);
        closePanel();

        if (feature) {
          showUndoToast({
            description: `"${feature.title}" deleted`,
            undo: async () => {
              const newFeature = await createFeatureMutation.mutateAsync({
                projectId: feature.projectId,
                title: feature.title,
                description: feature.description ?? undefined,
                startDate: new Date(feature.startDate),
                endDate: new Date(feature.endDate),
                duration: feature.duration,
                status: feature.status,
                priority: feature.priority,
                progress: feature.progress,
                sortOrder: feature.sortOrder,
              });
              for (const dep of featureDeps) {
                const predId = dep.predecessorId === id ? newFeature.id : dep.predecessorId;
                const succId = dep.successorId === id ? newFeature.id : dep.successorId;
                try {
                  await createDependencyMutation.mutateAsync({ predecessorId: predId, successorId: succId });
                } catch { /* target may not exist */ }
              }
              for (const td of featureTeamDurs) {
                try {
                  await upsertTeamDurationMutation.mutateAsync({
                    milestoneId: newFeature.id,
                    teamId: td.teamId,
                    duration: td.duration,
                  });
                } catch { /* team may not exist */ }
              }
            },
          });
        }
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteFeatureMutation, closePanel, features, dependencies, teamDurations, showUndoToast, createFeatureMutation, createDependencyMutation, upsertTeamDurationMutation]
  );

  const queryClient = useQueryClient();

  const milestoneOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects]
  );

  const handleMoveFeature = useCallback(
    async (featureId: string, targetProjectId: string) => {
      const feature = features.find((f) => f.id === featureId);
      const oldProjectId = feature?.projectId;
      const newMilestoneName = projects.find((p) => p.id === targetProjectId)?.name;

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
              queryClient.invalidateQueries({ queryKey: ["milestones"] });
              queryClient.invalidateQueries({ queryKey: ["dependencies"] });
              queryClient.invalidateQueries({ queryKey: ["projects"] });
              queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
            },
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move feature");
      }
    },
    [queryClient, closePanel, features, projects, showUndoToast]
  );

  const handleDeleteFeatureFromTimeline = useCallback(
    async (id: string) => {
      const feature = features.find((f) => f.id === id);
      const featureDeps = dependencies.filter(
        (d) => d.predecessorId === id || d.successorId === id
      );
      const featureTeamDurs = teamDurations.filter((td) => td.milestoneId === id);

      try {
        await deleteFeatureMutation.mutateAsync(id);

        if (feature) {
          showUndoToast({
            description: `"${feature.title}" deleted`,
            undo: async () => {
              const newFeature = await createFeatureMutation.mutateAsync({
                projectId: feature.projectId,
                title: feature.title,
                description: feature.description ?? undefined,
                startDate: new Date(feature.startDate),
                endDate: new Date(feature.endDate),
                duration: feature.duration,
                status: feature.status,
                priority: feature.priority,
                progress: feature.progress,
                sortOrder: feature.sortOrder,
              });
              for (const dep of featureDeps) {
                const predId = dep.predecessorId === id ? newFeature.id : dep.predecessorId;
                const succId = dep.successorId === id ? newFeature.id : dep.successorId;
                try {
                  await createDependencyMutation.mutateAsync({ predecessorId: predId, successorId: succId });
                } catch { /* target may not exist */ }
              }
              for (const td of featureTeamDurs) {
                try {
                  await upsertTeamDurationMutation.mutateAsync({
                    milestoneId: newFeature.id,
                    teamId: td.teamId,
                    duration: td.duration,
                  });
                } catch { /* team may not exist */ }
              }
            },
          });
        }
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteFeatureMutation, features, dependencies, teamDurations, showUndoToast, createFeatureMutation, createDependencyMutation, upsertTeamDurationMutation]
  );

  const handleUpdateDates = useCallback(
    async (
      id: string,
      startDate: Date,
      endDate: Date,
      duration?: number,
      dragType?: 'move' | 'resize-start' | 'resize-end'
    ): Promise<CascadedUpdate[]> => {
      const feature = features.find((f) => f.id === id);
      const oldStartDate = feature ? new Date(feature.startDate) : null;
      const oldEndDate = feature ? new Date(feature.endDate) : null;
      const oldDuration = feature?.duration;

      try {
        const computedDuration = duration ?? Math.max(0, differenceInDays(endDate, startDate) + 1);
        const result = await updateFeatureMutation.mutateAsync({
          id,
          startDate,
          endDate,
          duration: computedDuration,
          dragType,
        });

        showUndoToast({
          description: `"${feature?.title ?? "Feature"}" dates updated`,
          silent: !!dragType,
          undo: async () => {
            if (oldStartDate && oldEndDate && oldDuration !== undefined) {
              await updateFeatureMutation.mutateAsync({
                id,
                startDate: oldStartDate,
                endDate: oldEndDate,
                duration: oldDuration,
                // Use same dragType so server does reverse delta-shift
                // (not authoritative reflow which can close gaps / cascade unexpectedly)
                ...(dragType ? { dragType } : {}),
              });
            }
          },
        });

        return result.cascadedUpdates || [];
      } catch {
        toast.error("Failed to update dates");
        return [];
      }
    },
    [updateFeatureMutation, features, showUndoToast]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: MilestoneStatus) => {
      const feature = features.find((f) => f.id === id);
      const oldStatus = feature?.status;

      try {
        await updateFeatureMutation.mutateAsync({ id, status });

        showUndoToast({
          description: describeUpdate({ status }, feature?.title),
          undo: async () => {
            if (oldStatus) {
              await updateFeatureMutation.mutateAsync({ id, status: oldStatus });
            }
          },
        });
      } catch {
        toast.error("Failed to update status");
      }
    },
    [updateFeatureMutation, features, showUndoToast]
  );

  const handlePriorityChange = useCallback(
    async (id: string, priority: string) => {
      const feature = features.find((f) => f.id === id);
      const oldPriority = feature?.priority;

      try {
        await updateFeatureMutation.mutateAsync({ id, priority: priority as Milestone["priority"] });

        showUndoToast({
          description: describeUpdate({ priority }, feature?.title),
          undo: async () => {
            if (oldPriority) {
              await updateFeatureMutation.mutateAsync({ id, priority: oldPriority });
            }
          },
        });
      } catch {
        toast.error("Failed to update priority");
      }
    },
    [updateFeatureMutation, features, showUndoToast]
  );

  const { open: openContextMenu, menu: contextMenuEl } = useFeatureContextMenu({
    onOpen: (id) => {
      const feature = features.find((f) => f.id === id);
      if (feature) handleEditFeature(feature);
    },
    onStatusChange: (id, status) => handleStatusChange(id, status as MilestoneStatus),
    onPriorityChange: handlePriorityChange,
    onDelete: handleDeleteFeatureFromTimeline,
  });

  const handleFeatureContextMenu = useCallback(
    (featureId: string, status: string, priority: string, e: MouseEvent) => {
      openContextMenu({ featureId, status, priority }, e);
    },
    [openContextMenu]
  );

  const handleCreateDependency = useCallback(
    async (predecessorId: string, successorId: string) => {
      try {
        const result = await createDependencyMutation.mutateAsync({
          predecessorId,
          successorId,
        });

        const predFeature = features.find((f) => f.id === predecessorId);
        const succFeature = features.find((f) => f.id === successorId);
        showUndoToast({
          description: `Dependency: "${predFeature?.title ?? "?"}" → "${succFeature?.title ?? "?"}"`,
          undo: async () => {
            await deleteDependencyMutation.mutateAsync(result.dependency.id);
          },
        });
      } catch {
        toast.error("Failed to create dependency");
      }
    },
    [createDependencyMutation, deleteDependencyMutation, features, showUndoToast]
  );

  const handleDeleteDependency = useCallback(
    async (id: string) => {
      // Snapshot the dependency before deleting
      const dep = dependencies.find((d) => d.id === id);

      try {
        await deleteDependencyMutation.mutateAsync(id);

        if (dep) {
          const predFeature = features.find((f) => f.id === dep.predecessorId);
          const succFeature = features.find((f) => f.id === dep.successorId);
          showUndoToast({
            description: `Dependency removed: "${predFeature?.title ?? "?"}" → "${succFeature?.title ?? "?"}"`,
            undo: async () => {
              await createDependencyMutation.mutateAsync({
                predecessorId: dep.predecessorId,
                successorId: dep.successorId,
              });
            },
          });
        }
      } catch {
        toast.error("Failed to delete dependency");
      }
    },
    [deleteDependencyMutation, createDependencyMutation, dependencies, features, showUndoToast]
  );

  const handleUpdateDependencyLag = useCallback(
    async (depId: string, lag: number) => {
      const dep = dependencies.find((d) => d.id === depId);
      const oldLag = (dep as unknown as { lag?: number })?.lag ?? 0;

      try {
        await updateDependencyLagMutation.mutateAsync({ id: depId, lag });

        showUndoToast({
          description: `Gap updated to +${lag}d`,
          undo: async () => {
            await updateDependencyLagMutation.mutateAsync({ id: depId, lag: oldLag });
          },
        });
      } catch {
        toast.error("Failed to update dependency gap");
      }
    },
    [updateDependencyLagMutation, dependencies, showUndoToast]
  );

  const handleUpdateTeamDuration = useCallback(
    async (milestoneId: string, teamId: string, duration: number, startDate?: Date) => {
      const oldTd = teamDurations.find(
        (td) => td.milestoneId === milestoneId && td.teamId === teamId
      );
      const hadOld = !!oldTd;
      const oldDuration = oldTd?.duration;
      const oldStartDate = oldTd?.startDate ? new Date(oldTd.startDate).toISOString() : undefined;

      try {
        await upsertTeamDurationMutation.mutateAsync({
          milestoneId,
          teamId,
          duration,
          startDate: startDate?.toISOString(),
        });

        showUndoToast({
          description: hadOld ? "Team duration updated" : "Team track added",
          silent: !!startDate,
          undo: async () => {
            if (hadOld && oldDuration !== undefined) {
              await upsertTeamDurationMutation.mutateAsync({ milestoneId, teamId, duration: oldDuration, startDate: oldStartDate });
            } else {
              await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });
            }
          },
        });
      } catch {
        toast.error("Failed to update team duration");
      }
    },
    [upsertTeamDurationMutation, deleteTeamDurationMutation, teamDurations, showUndoToast]
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
          toast.success("Feature created & chained", { description: name });
        } else {
          toast.success("Feature created", { description: name });
        }
      } catch {
        toast.error("Failed to create feature");
      }
    },
    [selectedMilestoneId, createFeatureMutation, createDependencyMutation, features.length]
  );

  const handleDeleteTeamDuration = useCallback(
    async (milestoneId: string, teamId: string) => {
      const oldTd = teamDurations.find(
        (td) => td.milestoneId === milestoneId && td.teamId === teamId
      );

      try {
        await deleteTeamDurationMutation.mutateAsync({ milestoneId, teamId });

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
          },
        });
      } catch {
        toast.error("Failed to remove team track");
      }
    },
    [deleteTeamDurationMutation, upsertTeamDurationMutation, teamDurations, showUndoToast]
  );

  const handleReorderFeatures = useCallback(
    async (projectId: string, orderedFeatureIds: string[]) => {
      const oldOrder = features
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((f) => f.id);

      try {
        await reorderMutation.mutateAsync({ projectId, orderedFeatureIds });

        showUndoToast({
          description: "Features reordered",
          undo: async () => {
            await reorderMutation.mutateAsync({ projectId, orderedFeatureIds: oldOrder });
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reorder features");
      }
    },
    [reorderMutation, features, showUndoToast]
  );

  const handleTightenGaps = useCallback(async () => {
    if (!selectedMilestoneId) return;
    try {
      const result = await tightenGapsMutation.mutateAsync(selectedMilestoneId);
      if (result.count > 0) {
        toast.success("Chain gaps cleaned up", {
          description: `${result.count} feature${result.count === 1 ? "" : "s"} adjusted`,
        });
      } else {
        toast("No gaps to clean up", {
          description: "All chains are already tight",
        });
      }
    } catch {
      toast.error("Failed to clean up chain gaps");
    }
  }, [selectedMilestoneId, tightenGapsMutation]);

  // Loading state — show skeleton while projects are being fetched
  if (isLoadingProjects) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="min-h-0 flex-1 p-2 sm:p-4 md:p-6">
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
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
          <ChartGantt className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No milestones yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Create a milestone first to view its timeline.
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
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Timeline chart */}
      {selectedMilestone && (
        <div className="min-h-0 flex-1 p-2 sm:p-4 md:p-6">
          <div className="h-full flex flex-col">
            <DynamicTimelineView
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
              onFeatureContextMenu={handleFeatureContextMenu}
              onTightenGaps={handleTightenGaps}
              isTighteningGaps={tightenGapsMutation.isPending}
            />
          </div>
        </div>
      )}

      {contextMenuEl}

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
            "feature-island-panel absolute z-50 overflow-hidden bg-background rounded-2xl border border-border shadow-[0_8px_40px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-300 ease-out",
            // Mobile: bottom-anchored full-width panel
            "inset-x-2 bottom-2 top-auto max-h-[60vh]",
            // Desktop: right-side floating island
            "md:inset-x-auto md:top-10 md:bottom-10 md:right-10 md:w-[480px] md:min-w-[320px] md:max-w-[calc(100%-5rem)] md:max-h-none",
            panelVisible
              ? "translate-x-0 opacity-100"
              : "translate-x-8 opacity-0 pointer-events-none"
          )}
        >
          <div className="h-full overflow-y-auto [scrollbar-gutter:stable] overflow-x-hidden">
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
                onUpdate={handleUpdateFeatureSilent}
                onDelete={handleDeleteFeature}
                onUpsertTeamDuration={handleUpdateTeamDuration}
                onDeleteTeamDuration={handleDeleteTeamDuration}
                onCreateDependency={handleCreateDependency}
                onDeleteDependency={handleDeleteDependency}
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
                    toast.success(chainToId ? "Feature created & chained" : "Feature added", { description: milestoneData.title });
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
