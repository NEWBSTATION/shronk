"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { FeatureDialog } from "@/components/feature/feature-dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureDetailPanel } from "@/components/drilldown/panels/feature-detail-panel";
import { MilestoneInfoPanel } from "@/components/drilldown/panels/milestone-info-panel";
import { useTeams, useUpdateMilestone, useDeleteMilestone } from "@/hooks/use-milestones";
import {
  featuresToCalendarEvents,
  type CalendarTeamDuration,
  type CalendarTeam,
} from "@/components/calendar/calendar-transformers";
import { useCalendarStore } from "@/store/calendar-store";
import { cn } from "@/lib/utils";
import type { Milestone, MilestoneDependency } from "@/db/schema";

const CalendarView = dynamic(
  () => import("@/components/calendar/calendar-view").then((m) => m.CalendarView),
  {
    ssr: false,
    loading: () => <CalendarSkeleton />,
  }
);

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

interface FeaturesResponse {
  features: Feature[];
  milestones: MilestoneOption[];
  dependencies: { id: string; predecessorId: string; successorId: string }[];
  teamDurations: CalendarTeamDuration[];
  teams: CalendarTeam[];
}

async function fetchFeatures(): Promise<FeaturesResponse> {
  const response = await fetch("/api/features");
  if (!response.ok) throw new Error("Failed to fetch features");
  return response.json();
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-[100px] rounded-md" />
          <div className="h-4 w-px bg-border" />
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-5 w-32 rounded" />
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <div className="h-full border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-2 py-2 border-r border-border last:border-r-0">
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="grid grid-cols-7 border-b border-border last:border-b-0" style={{ height: "20%" }}>
              {Array.from({ length: 7 }).map((_, col) => (
                <div key={col} className="px-2 py-1 border-r border-border last:border-r-0">
                  <Skeleton className="h-3 w-4 mb-1" />
                  {row % 2 === 0 && col % 3 === 0 && <Skeleton className="h-4 w-full rounded" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CalendarTabProps {
  isActive?: boolean;
}

export function CalendarTab({ isActive = true }: CalendarTabProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["allFeatures"],
    queryFn: fetchFeatures,
  });

  const features = data?.features ?? [];
  const milestoneOptions = data?.milestones ?? [];
  const teamDurations = data?.teamDurations ?? [];
  const responseTeams = data?.teams ?? [];

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);

  const { data: teamsData } = useTeams();
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

  // --- Persisted calendar state from store ---
  const calendarViewType = useCalendarStore((s) => s.viewType);
  const storeVisibleTeamIds = useCalendarStore((s) => s.visibleTeamIds);
  const setStoreVisibleTeamIds = useCalendarStore((s) => s.setVisibleTeamIds);
  const toggleTeamVisibility = useCalendarStore((s) => s.toggleTeamVisibility);

  // Initialize visible teams when data first loads and store is uninitialized (null)
  const initializedTeams = useRef(false);
  useEffect(() => {
    if (!initializedTeams.current && responseTeams.length > 0 && storeVisibleTeamIds === null) {
      initializedTeams.current = true;
      setStoreVisibleTeamIds(responseTeams.map((t) => t.id));
    }
  }, [responseTeams, storeVisibleTeamIds, setStoreVisibleTeamIds]);

  // Prune stale team IDs that no longer exist (don't add new ones — that's init's job)
  const prevTeamsRef = useRef(responseTeams);
  useEffect(() => {
    if (storeVisibleTeamIds === null || responseTeams.length === 0) return;
    const currentSet = new Set(responseTeams.map((t) => t.id));
    const pruned = storeVisibleTeamIds.filter((id) => currentSet.has(id));
    // Only auto-show genuinely new teams (added since last render), not toggled-off ones
    const prevIds = new Set(prevTeamsRef.current.map((t) => t.id));
    const brandNewTeamIds = responseTeams
      .filter((t) => !prevIds.has(t.id))
      .map((t) => t.id);
    prevTeamsRef.current = responseTeams;
    const updated = [...pruned, ...brandNewTeamIds];
    if (updated.length !== storeVisibleTeamIds.length || brandNewTeamIds.length > 0) {
      setStoreVisibleTeamIds(updated);
    }
  }, [responseTeams, storeVisibleTeamIds, setStoreVisibleTeamIds]);

  const visibleTeamIds = storeVisibleTeamIds ?? [];

  const handleToggleTeam = useCallback((teamId: string) => {
    toggleTeamVisibility(teamId);
  }, [toggleTeamVisibility]);

  const handleShowAllTeams = useCallback(() => {
    setStoreVisibleTeamIds(responseTeams.map((t) => t.id));
  }, [responseTeams, setStoreVisibleTeamIds]);

  const handleHideAllTeams = useCallback(() => {
    setStoreVisibleTeamIds([]);
  }, [setStoreVisibleTeamIds]);

  // Filter team durations by visible teams
  const filteredTeamDurations = useMemo(
    () => teamDurations.filter((td) => visibleTeamIds.includes(td.teamId)),
    [teamDurations, visibleTeamIds]
  );

  const events = useMemo(
    () => featuresToCalendarEvents(features, milestoneOptions, filteredTeamDurations, responseTeams),
    [features, milestoneOptions, filteredTeamDurations, responseTeams]
  );

  // --- Floating island panel (same pattern as timeline-tab) ---
  const [panelContent, setPanelContent] = useState<ReactNode | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const panelTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  const openPanel = useCallback((content: ReactNode) => {
    clearTimeout(panelTimerRef.current);
    setPanelContent(content);
    requestAnimationFrame(() => setPanelVisible(true));
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
    panelTimerRef.current = setTimeout(() => {
      setPanelContent(null);
    }, 300);
  }, []);

  // Close panel when tab becomes inactive
  useEffect(() => {
    if (!isActive && panelContent) {
      clearTimeout(panelTimerRef.current);
      setPanelVisible(false);
      setPanelContent(null);
    }
  }, [isActive, panelContent]);

  // Close on Escape
  useEffect(() => {
    if (!panelContent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelContent, closePanel]);

  // Close on click outside
  useEffect(() => {
    if (!panelVisible) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (target.closest("[data-radix-popper-content-wrapper], [role='dialog'], [data-radix-select-viewport], [data-radix-menu-content]")) return;
      closePanel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelVisible, closePanel]);

  // --- Mutations ---
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
      const feature = features.find((f) => f.id === id);
      try {
        await deleteMutation.mutateAsync(id);
        queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
        closePanel();
        toast.success("Feature deleted", { description: feature?.title });
      } catch {
        toast.error("Failed to delete feature");
      }
    },
    [deleteMutation, queryClient, closePanel, features]
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
        closePanel();
        toast.success("Feature moved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to move feature");
      }
    },
    [queryClient, closePanel]
  );

  // --- Event click handler ---
  const handleEventClick = useCallback(
    (featureId: string, _projectId: string) => {
      const feature = features.find((f) => f.id === featureId);
      if (!feature) return;

      openPanel(
        <FeatureDetailPanel
          feature={feature as unknown as Milestone}
          teams={teams}
          projectName={feature.milestoneName}
          dependencies={(data?.dependencies ?? []) as unknown as MilestoneDependency[]}
          milestoneOptions={milestoneOptions}
          selectedMilestoneId={feature.projectId}
          onMilestoneChange={(targetId) => {
            if (targetId && targetId !== feature.projectId) {
              handleMoveFeature(feature.id, targetId);
            }
          }}
          onUpdate={handleUpdateFeature}
          onDelete={handleDeleteFeature}
          onBack={closePanel}
        />
      );
    },
    [features, milestoneOptions, teams, data?.dependencies, handleUpdateFeature, handleDeleteFeature, handleMoveFeature, openPanel, closePanel]
  );

  // --- Milestone badge click handler ---
  const handleMilestoneClick = useCallback(
    (milestoneId: string) => {
      const milestone = milestoneOptions.find((m) => m.id === milestoneId);
      if (!milestone) return;

      openPanel(
        <MilestoneInfoPanel
          milestone={milestone}
          onBack={closePanel}
        />
      );
    },
    [milestoneOptions, openPanel, closePanel]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-6">
        <CalendarSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-destructive/10 mb-4">
          <CalendarDays className="h-8 w-8 text-destructive/60" />
        </div>
        <h3 className="text-lg font-semibold">Failed to load calendar</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
          Something went wrong fetching your calendar data. Check your connection and try again.
        </p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["allFeatures"] })}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-muted hover:bg-accent text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (features.length === 0) {
    const hasMilestones = milestoneOptions.length > 0;
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 py-8">
          <CalendarDays className="h-16 w-16 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">
            {hasMilestones ? "No features yet" : "No milestones yet"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {hasMilestones
              ? "Add features to your milestones to see them on the calendar."
              : "Create a milestone and add features to see them on the calendar."}
          </p>
          <Button
            className="mt-4"
            onClick={() =>
              hasMilestones
                ? setFeatureDialogOpen(true)
                : setMilestoneDialogOpen(true)
            }
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {hasMilestones ? "Create Feature" : "Create Milestone"}
          </Button>
        </div>
        <MilestoneDialog
          open={milestoneDialogOpen}
          onOpenChange={setMilestoneDialogOpen}
        />
        <FeatureDialog
          open={featureDialogOpen}
          onOpenChange={setFeatureDialogOpen}
          milestones={milestoneOptions}
          teams={teams}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div className="min-h-0 flex-1 p-6">
        <div className="h-full flex flex-col">
          <CalendarView
            events={events}
            teams={responseTeams}
            visibleTeamIds={visibleTeamIds}
            onToggleTeam={handleToggleTeam}
            onShowAllTeams={handleShowAllTeams}
            onHideAllTeams={handleHideAllTeams}
            hasTeamTracks={teamDurations.length > 0}
            onEventClick={handleEventClick}
            onMilestoneClick={handleMilestoneClick}
            initialViewType={calendarViewType}
          />
        </div>
      </div>

      {/* Floating island panel — same as timeline */}
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
            {panelContent}
          </div>
        </div>
      )}
    </div>
  );
}
