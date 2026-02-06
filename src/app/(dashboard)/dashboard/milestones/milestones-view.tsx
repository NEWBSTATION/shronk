"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MilestoneOverview,
  FeatureDialog,
} from "@/components/milestone";
import { SVARGanttView } from "@/components/gantt";
import { GanttFeatureSheet } from "@/components/gantt/gantt-feature-sheet";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import {
  useMilestones,
  useMilestoneStats,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useTeams,
  useDependencies,
  useCreateDependency,
  useDeleteDependency,
} from "@/hooks/use-milestones";
import { useHeader } from "@/components/header-context";
import type { CascadedUpdate } from "@/hooks/use-milestones";
import type {
  Project,
  Milestone,
  MilestoneStatus,
} from "@/db/schema";

interface MilestonesViewProps {
  projects: Project[];
}

type ViewLevel = "overview" | "detail";

export function MilestonesView({ projects }: MilestonesViewProps) {
  const { clearBreadcrumbs, setHeaderAction, clearHeaderAction } = useHeader();

  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>("overview");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null
  );

  // Dialog states
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

  // Set header action for New Milestone button when in overview
  useEffect(() => {
    if (viewLevel === "overview") {
      clearBreadcrumbs();
      setHeaderAction(
        <Button
          onClick={() => setMilestoneDialogOpen(true)}
          className="h-7 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Milestone
        </Button>
      );
    } else {
      clearHeaderAction();
    }

    return () => clearHeaderAction();
  }, [viewLevel, clearBreadcrumbs, setHeaderAction, clearHeaderAction]);

  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Milestone | null>(null);

  // Sheet state for editing features from Gantt
  const [featureSheetOpen, setFeatureSheetOpen] = useState(false);
  const [sheetFeature, setSheetFeature] = useState<Milestone | null>(null);

  // Get selected milestone
  const selectedMilestone = projects.find((p) => p.id === selectedMilestoneId);

  // Fetch milestone stats for overview
  const { data: statsData } = useMilestoneStats();
  const stats = statsData?.stats || [];

  // Fetch features for selected milestone
  const { data: featuresData, isLoading: featuresLoading } = useMilestones({
    projectId: selectedMilestoneId || "",
    sortField: "sortOrder",
    sortDirection: "asc",
  });

  const features = featuresData?.milestones || [];

  // Fetch teams for selected milestone
  const { data: teamsData } = useTeams(selectedMilestoneId || "");
  const teams = teamsData?.teams || [];

  // Fetch dependencies for selected milestone
  const { data: dependenciesData } = useDependencies(selectedMilestoneId || "");
  const dependencies = dependenciesData?.dependencies || [];

  // Mutations
  const createFeatureMutation = useCreateMilestone();
  const updateFeatureMutation = useUpdateMilestone();
  const deleteFeatureMutation = useDeleteMilestone();
  const createDependencyMutation = useCreateDependency();
  const deleteDependencyMutation = useDeleteDependency();

  // Handlers: Navigation
  const handleSelectMilestone = useCallback((milestoneId: string) => {
    setSelectedMilestoneId(milestoneId);
    setViewLevel("detail");
  }, []);

  const handleBack = useCallback(() => {
    setViewLevel("overview");
    setSelectedMilestoneId(null);
  }, []);

  // Handlers: Feature CRUD
  const handleAddFeature = useCallback(() => {
    setEditingFeature(null);
    setFeatureDialogOpen(true);
  }, []);

  const handleEditFeature = useCallback((feature: Milestone) => {
    setSheetFeature(feature);
    setFeatureSheetOpen(true);
  }, []);

  const handleSaveFeature = useCallback(
    async (formData: {
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      duration?: number;
      status: MilestoneStatus;
      teamId?: string | null;
    }) => {
      if (!selectedMilestoneId) return;

      try {
        if (editingFeature) {
          await updateFeatureMutation.mutateAsync({
            id: editingFeature.id,
            ...formData,
          });
          toast.success("Feature updated");
        } else {
          await createFeatureMutation.mutateAsync({
            projectId: selectedMilestoneId,
            ...formData,
          });
          toast.success("Feature added");
        }
        setFeatureDialogOpen(false);
        setEditingFeature(null);
      } catch (error) {
        toast.error(
          editingFeature ? "Failed to update feature" : "Failed to add feature"
        );
      }
    },
    [
      selectedMilestoneId,
      editingFeature,
      createFeatureMutation,
      updateFeatureMutation,
    ]
  );

  const handleDeleteFeature = useCallback(
    async (id: string) => {
      try {
        await deleteFeatureMutation.mutateAsync(id);
        toast.success("Feature deleted");
      } catch (error) {
        toast.error("Failed to delete feature");
      }
    },
    [deleteFeatureMutation]
  );

  const handleUpdateFeatureDates = useCallback(
    async (
      id: string,
      startDate: Date,
      endDate: Date,
      duration?: number,
    ): Promise<CascadedUpdate[]> => {
      try {
        const result = await updateFeatureMutation.mutateAsync({
          id,
          startDate,
          endDate,
          duration: duration ?? Math.max(1, differenceInDays(endDate, startDate) + 1),
        });
        return result.cascadedUpdates || [];
      } catch (error) {
        toast.error("Failed to update dates");
        return [];
      }
    },
    [updateFeatureMutation]
  );

  // Sheet callbacks (shared hooks)
  const handleSheetUpdate = useCallback(
    async (data: Partial<Milestone> & { id: string; duration?: number }) => {
      try {
        await updateFeatureMutation.mutateAsync(data);
        toast.success("Feature updated");
      } catch (error) {
        toast.error("Failed to update feature");
      }
    },
    [updateFeatureMutation]
  );

  const handleSheetDelete = useCallback(
    async (id: string) => {
      try {
        await deleteFeatureMutation.mutateAsync(id);
        toast.success("Feature deleted");
      } catch (error) {
        toast.error("Failed to delete feature");
      }
    },
    [deleteFeatureMutation]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: MilestoneStatus) => {
      try {
        await updateFeatureMutation.mutateAsync({ id, status });
        toast.success("Status updated");
      } catch (error) {
        toast.error("Failed to update status");
      }
    },
    [updateFeatureMutation]
  );

  const handleCreateDependency = useCallback(
    async (predecessorId: string, successorId: string) => {
      try {
        await createDependencyMutation.mutateAsync({ predecessorId, successorId });
      } catch (error) {
        toast.error("Failed to create dependency");
      }
    },
    [createDependencyMutation]
  );

  const handleDeleteDependency = useCallback(
    async (id: string) => {
      try {
        await deleteDependencyMutation.mutateAsync(id);
      } catch (error) {
        toast.error("Failed to delete dependency");
      }
    },
    [deleteDependencyMutation]
  );

  const handleReorderFeature = useCallback(
    async (featureId: string, newIndex: number) => {
      // TODO: Implement reordering
      console.log("Reorder feature", featureId, "to index", newIndex);
    },
    []
  );

  // Render based on view level
  if (viewLevel === "detail" && selectedMilestone) {
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full">
        <SVARGanttView
          project={selectedMilestone}
          features={features}
          dependencies={dependencies}
          teams={teams}
          onBack={handleBack}
          onEdit={handleEditFeature}
          onDelete={handleDeleteFeature}
          onUpdateDates={handleUpdateFeatureDates}
          onStatusChange={handleStatusChange}
          onAddFeature={handleAddFeature}
          onCreateDependency={handleCreateDependency}
          onDeleteDependency={handleDeleteDependency}
        />

        <FeatureDialog
          open={featureDialogOpen}
          onOpenChange={(open) => {
            setFeatureDialogOpen(open);
            if (!open) setEditingFeature(null);
          }}
          feature={editingFeature}
          teams={teams}
          onSave={handleSaveFeature}
          isLoading={
            createFeatureMutation.isPending || updateFeatureMutation.isPending
          }
        />

        <GanttFeatureSheet
          feature={sheetFeature}
          open={featureSheetOpen}
          onOpenChange={(open) => {
            setFeatureSheetOpen(open);
            if (!open) setSheetFeature(null);
          }}
          teams={teams}
          projectName={selectedMilestone.name}
          dependencies={dependencies}
          onUpdate={handleSheetUpdate}
          onDelete={handleSheetDelete}
        />
      </div>
    );
  }

  // Default: Overview
  return (
    <div className="flex-1 min-h-0">
      <MilestoneOverview
        milestones={projects}
        stats={stats}
        onSelectMilestone={handleSelectMilestone}
        onCreateMilestone={() => setMilestoneDialogOpen(true)}
      />

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
      />
    </div>
  );
}
