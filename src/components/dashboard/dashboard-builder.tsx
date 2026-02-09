"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useProjects, useMilestones, useTeams } from "@/hooks/use-milestones";
import { useMembers } from "@/hooks/use-members";
import {
  useDashboardLayout,
  useSaveDashboardLayout,
} from "@/hooks/use-dashboard-layout";
import { useHeader } from "@/components/header-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Layers,
  ArrowRight,
  Target,
  Pencil,
  Plus,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { WidgetConfig, GlobalFilters } from "@/types/dashboard";
import { DashboardGrid } from "./dashboard-grid";
import { WidgetRenderer } from "./widget-renderer";
import { GlobalFilterBar } from "./global-filter-bar";
import { WidgetPickerDialog } from "./widget-picker-dialog";
import { WidgetSettingsSheet } from "./widget-settings-sheet";
import { DashboardSkeleton } from "./dashboard-skeleton";

const STORAGE_KEY = "dashboard-selected-project";

export function DashboardBuilder() {
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const { data: membersData } = useMembers();
  const { setHeaderAction, clearHeaderAction } = useHeader();
  const saveMutation = useSaveDashboardLayout();

  const isAdmin = membersData?.currentUserRole === "admin";

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    }
    return "";
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [localWidgets, setLocalWidgets] = useState<WidgetConfig[]>([]);
  const [localFilters, setLocalFilters] = useState<GlobalFilters>({
    status: [],
    priority: [],
    teamId: [],
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsWidget, setSettingsWidget] = useState<WidgetConfig | null>(
    null
  );

  // Persist selection to localStorage
  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem(STORAGE_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

  // Auto-select first project if none saved
  useEffect(() => {
    if (!projectsData?.projects.length) return;
    const ids = new Set(projectsData.projects.map((p) => p.id));
    if (!selectedProjectId || !ids.has(selectedProjectId)) {
      setSelectedProjectId(projectsData.projects[0].id);
    }
  }, [projectsData, selectedProjectId]);

  const { data: milestonesData, isLoading: milestonesLoading } = useMilestones({
    projectId: selectedProjectId,
  });
  const { data: teamsData } = useTeams(selectedProjectId);
  const { data: layoutData, isLoading: layoutLoading } =
    useDashboardLayout(selectedProjectId);

  const ms = milestonesData?.milestones ?? [];
  const deps = milestonesData?.dependencies ?? [];
  const teamsList = teamsData?.teams ?? [];

  // Sync server layout to local state when not editing
  useEffect(() => {
    if (!isEditMode && layoutData) {
      setLocalWidgets(layoutData.widgets);
      setLocalFilters(
        layoutData.globalFilters || { status: [], priority: [], teamId: [] }
      );
    }
  }, [layoutData, isEditMode]);

  // Active filters (edit mode uses local, view mode uses server data)
  const activeWidgets = isEditMode ? localWidgets : (layoutData?.widgets ?? []);
  const activeFilters = isEditMode
    ? localFilters
    : (layoutData?.globalFilters ?? { status: [], priority: [], teamId: [] });

  // Edit mode actions — use refs to avoid re-render loops with header effect
  const layoutDataRef = useRef(layoutData);
  layoutDataRef.current = layoutData;
  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  const localWidgetsRef = useRef(localWidgets);
  localWidgetsRef.current = localWidgets;
  const localFiltersRef = useRef(localFilters);
  localFiltersRef.current = localFilters;
  const saveMutationRef = useRef(saveMutation);
  saveMutationRef.current = saveMutation;

  const handleEnterEdit = useCallback(() => {
    const ld = layoutDataRef.current;
    if (ld) {
      setLocalWidgets(ld.widgets);
      setLocalFilters(
        ld.globalFilters || { status: [], priority: [], teamId: [] }
      );
    }
    setIsEditMode(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditMode(false);
    const ld = layoutDataRef.current;
    if (ld) {
      setLocalWidgets(ld.widgets);
      setLocalFilters(
        ld.globalFilters || { status: [], priority: [], teamId: [] }
      );
    }
  }, []);

  const handleSave = useCallback(async () => {
    const pid = selectedProjectIdRef.current;
    if (!pid) return;
    try {
      await saveMutationRef.current.mutateAsync({
        projectId: pid,
        widgets: localWidgetsRef.current,
        globalFilters: localFiltersRef.current,
      });
      setIsEditMode(false);
      toast.success("Dashboard layout saved");
    } catch {
      toast.error("Failed to save layout");
    }
  }, []);

  const handleDeleteWidget = useCallback((id: string) => {
    setLocalWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleAddWidget = useCallback((widget: WidgetConfig) => {
    setLocalWidgets((prev) => [...prev, widget]);
  }, []);

  const handleUpdateWidgetSettings = useCallback(
    (updated: WidgetConfig) => {
      setLocalWidgets((prev) =>
        prev.map((w) => (w.id === updated.id ? updated : w))
      );
      setSettingsWidget(null);
    },
    []
  );

  // Header actions — only re-run when display conditions change
  const isSaving = saveMutation.isPending;
  useEffect(() => {
    if (!isAdmin || !selectedProjectId || ms.length === 0) {
      clearHeaderAction();
      return;
    }

    if (isEditMode) {
      setHeaderAction(
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelEdit}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Widget
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save Layout"}
          </Button>
        </div>
      );
    } else {
      setHeaderAction(
        <Button variant="outline" size="sm" onClick={handleEnterEdit}>
          <Pencil className="h-4 w-4 mr-1" />
          Customize
        </Button>
      );
    }

    return () => clearHeaderAction();
  }, [
    isAdmin,
    isEditMode,
    selectedProjectId,
    ms.length,
    isSaving,
    handleCancelEdit,
    handleEnterEdit,
    handleSave,
    setHeaderAction,
    clearHeaderAction,
  ]);

  const isLoading =
    projectsLoading || (selectedProjectId && (milestonesLoading || layoutLoading));

  // No projects state
  if (!projectsLoading && !projectsData?.projects.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Target className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No milestones yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first project and add milestones to get started.
        </p>
        <Link
          href="/dashboard/milestones"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to Milestones
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          Project
        </label>
        {projectsLoading ? (
          <Skeleton className="h-9 w-[220px]" />
        ) : (
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projectsData?.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : ms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add features to this project to see them here.
          </p>
          <Link
            href="/dashboard/milestones"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Milestones
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Global Filter Bar */}
          {(isEditMode ||
            activeFilters.status.length > 0 ||
            activeFilters.priority.length > 0 ||
            activeFilters.teamId.length > 0) && (
            <GlobalFilterBar
              filters={activeFilters}
              teams={teamsList}
              isEditMode={isEditMode}
              onChange={setLocalFilters}
            />
          )}

          {/* Dashboard Grid */}
          <DashboardGrid
            widgets={activeWidgets}
            isEditMode={isEditMode}
            onLayoutChange={setLocalWidgets}
          >
            {(widget) => (
              <WidgetRenderer
                config={widget}
                milestones={ms}
                dependencies={deps}
                teams={teamsList}
                globalFilters={activeFilters}
                isEditMode={isEditMode}
                onSettings={setSettingsWidget}
                onDelete={handleDeleteWidget}
              />
            )}
          </DashboardGrid>
        </>
      )}

      {/* Widget Picker Dialog */}
      <WidgetPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAdd={handleAddWidget}
        widgets={localWidgets}
      />

      {/* Widget Settings Sheet */}
      <WidgetSettingsSheet
        widget={settingsWidget}
        teams={teamsList}
        onClose={() => setSettingsWidget(null)}
        onSave={handleUpdateWidgetSettings}
      />
    </div>
  );
}
