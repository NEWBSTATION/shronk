"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MilestoneOverview,
  FeatureDialog,
  FeatureTimeline,
} from "@/components/milestone";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import {
  useMilestones,
  useMilestoneStats,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useTeams,
} from "@/hooks/use-milestones";
import { useHeader } from "@/components/header-context";
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

  // Mutations
  const createFeatureMutation = useCreateMilestone();
  const updateFeatureMutation = useUpdateMilestone();
  const deleteFeatureMutation = useDeleteMilestone();

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
    setEditingFeature(feature);
    setFeatureDialogOpen(true);
  }, []);

  const handleSaveFeature = useCallback(
    async (formData: {
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
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
      cascadeAfter?: boolean
    ) => {
      try {
        // For cascade shifting, we'd need to update the API to support this
        // For now, just update the single feature
        await updateFeatureMutation.mutateAsync({
          id,
          startDate,
          endDate,
        });

        // If cascade is requested, shift features that come after
        if (cascadeAfter) {
          const feature = features.find((f) => f.id === id);
          if (feature) {
            const featureIndex = features
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .findIndex((f) => f.id === id);

            const followingFeatures = features
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .slice(featureIndex + 1);

            // Check if any following features need to be shifted
            const originalEndDate = new Date(feature.endDate);
            const daysDiff = Math.ceil(
              (endDate.getTime() - originalEndDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            if (daysDiff > 0) {
              // Shift following features
              for (const f of followingFeatures) {
                const newStart = new Date(f.startDate);
                const newEnd = new Date(f.endDate);
                newStart.setDate(newStart.getDate() + daysDiff);
                newEnd.setDate(newEnd.getDate() + daysDiff);

                await updateFeatureMutation.mutateAsync({
                  id: f.id,
                  startDate: newStart,
                  endDate: newEnd,
                });
              }
            }
          }
        }
      } catch (error) {
        toast.error("Failed to update dates");
      }
    },
    [updateFeatureMutation, features]
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
        <FeatureTimeline
          milestone={selectedMilestone}
          features={features}
          teams={teams}
          onBack={handleBack}
          onEdit={handleEditFeature}
          onDelete={handleDeleteFeature}
          onUpdateDates={handleUpdateFeatureDates}
          onStatusChange={handleStatusChange}
          onReorder={handleReorderFeature}
          onAddFeature={handleAddFeature}
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
