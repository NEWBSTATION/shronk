"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useGanttStore } from "@/store/gantt-store";
import { ViewSwitcher } from "@/components/shared/view-switcher";
import { ItemDialog } from "@/components/shared/item-dialog";
import { GanttView } from "@/components/gantt";
import { ListView } from "@/components/list-view";
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useBulkUpdateMilestones,
  useBulkDeleteMilestones,
  useTeams,
  useCreateDependency,
  useDeleteDependency,
} from "@/hooks/use-milestones";
import type { Project, Milestone, MilestoneStatus, MilestonePriority } from "@/db/schema";
import { Plus, FolderOpen } from "lucide-react";

interface MilestonesViewProps {
  projects: Project[];
}

export function MilestonesView({ projects }: MilestonesViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects[0]?.id || ""
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(
    null
  );

  const { viewType, filters, sortField, sortDirection, deselectAll } =
    useGanttStore();

  // Fetch data
  const { data, isLoading, error } = useMilestones({
    projectId: selectedProjectId,
    status: filters.status,
    priority: filters.priority,
    teamId: filters.teamId,
    search: filters.search,
    sortField,
    sortDirection,
  });

  const { data: teamsData } = useTeams(selectedProjectId);

  // Mutations
  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();
  const bulkUpdateMutation = useBulkUpdateMilestones();
  const bulkDeleteMutation = useBulkDeleteMilestones();
  const createDependencyMutation = useCreateDependency();
  const deleteDependencyMutation = useDeleteDependency();

  const milestones = data?.milestones || [];
  const dependencies = data?.dependencies || [];
  const teams = teamsData?.teams || [];

  // Handlers
  const handleCreateOrUpdate = useCallback(
    async (formData: {
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      status: MilestoneStatus;
      priority: MilestonePriority;
      progress: number;
      teamId?: string | null;
    }) => {
      try {
        if (editingMilestone) {
          await updateMutation.mutateAsync({
            id: editingMilestone.id,
            ...formData,
          });
          toast.success("Milestone updated");
        } else {
          await createMutation.mutateAsync({
            projectId: selectedProjectId,
            ...formData,
          });
          toast.success("Milestone created");
        }
        setDialogOpen(false);
        setEditingMilestone(null);
      } catch (error) {
        toast.error(
          editingMilestone
            ? "Failed to update milestone"
            : "Failed to create milestone"
        );
      }
    },
    [editingMilestone, selectedProjectId, createMutation, updateMutation]
  );

  const handleEdit = useCallback((milestone: Milestone) => {
    setEditingMilestone(milestone);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Milestone deleted");
      } catch (error) {
        toast.error("Failed to delete milestone");
      }
    },
    [deleteMutation]
  );

  const handleUpdateDates = useCallback(
    async (id: string, startDate: Date, endDate: Date) => {
      try {
        await updateMutation.mutateAsync({
          id,
          startDate,
          endDate,
          cascadeDependencies: true,
        });
      } catch (error) {
        toast.error("Failed to update dates");
      }
    },
    [updateMutation]
  );

  const handleStatusChange = useCallback(
    async (id: string, status: MilestoneStatus) => {
      try {
        await updateMutation.mutateAsync({ id, status });
        toast.success("Status updated");
      } catch (error) {
        toast.error("Failed to update status");
      }
    },
    [updateMutation]
  );

  const handlePriorityChange = useCallback(
    async (id: string, priority: MilestonePriority) => {
      try {
        await updateMutation.mutateAsync({ id, priority });
        toast.success("Priority updated");
      } catch (error) {
        toast.error("Failed to update priority");
      }
    },
    [updateMutation]
  );

  const handleBulkStatusChange = useCallback(
    async (ids: string[], status: MilestoneStatus) => {
      try {
        await bulkUpdateMutation.mutateAsync({ ids, updates: { status } });
        toast.success(`Updated ${ids.length} milestones`);
        deselectAll();
      } catch (error) {
        toast.error("Failed to update milestones");
      }
    },
    [bulkUpdateMutation, deselectAll]
  );

  const handleBulkPriorityChange = useCallback(
    async (ids: string[], priority: MilestonePriority) => {
      try {
        await bulkUpdateMutation.mutateAsync({ ids, updates: { priority } });
        toast.success(`Updated ${ids.length} milestones`);
        deselectAll();
      } catch (error) {
        toast.error("Failed to update milestones");
      }
    },
    [bulkUpdateMutation, deselectAll]
  );

  const handleBulkTeamChange = useCallback(
    async (ids: string[], teamId: string | null) => {
      try {
        await bulkUpdateMutation.mutateAsync({ ids, updates: { teamId } });
        toast.success(`Updated ${ids.length} milestones`);
        deselectAll();
      } catch (error) {
        toast.error("Failed to update milestones");
      }
    },
    [bulkUpdateMutation, deselectAll]
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      try {
        await bulkDeleteMutation.mutateAsync(ids);
        toast.success(`Deleted ${ids.length} milestones`);
        deselectAll();
      } catch (error) {
        toast.error("Failed to delete milestones");
      }
    },
    [bulkDeleteMutation, deselectAll]
  );

  const handleCreateDependency = useCallback(
    async (predecessorId: string, successorId: string) => {
      try {
        await createDependencyMutation.mutateAsync({
          predecessorId,
          successorId,
        });
        toast.success("Dependency created");
      } catch (error: any) {
        toast.error(error.message || "Failed to create dependency");
      }
    },
    [createDependencyMutation]
  );

  const handleDeleteDependency = useCallback(
    async (id: string) => {
      try {
        await deleteDependencyMutation.mutateAsync(id);
        toast.success("Dependency removed");
      } catch (error) {
        toast.error("Failed to remove dependency");
      }
    },
    [deleteDependencyMutation]
  );

  // Empty state - no projects
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <FolderOpen className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create a project first to start adding milestones and tracking
          progress with the Gantt chart.
        </p>
        <Button className="mt-4" asChild>
          <a href="/dashboard/projects">Go to Projects</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ViewSwitcher />
        </div>

        <Button
          variant="ghost"
          onClick={() => {
            setEditingMilestone(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Milestone
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-destructive">Failed to load milestones</p>
        </div>
      ) : viewType === "gantt" ? (
        <GanttView
          milestones={milestones}
          dependencies={dependencies}
          teams={teams}
          projectId={selectedProjectId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateDates={handleUpdateDates}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onCreateDependency={handleCreateDependency}
          onDeleteDependency={handleDeleteDependency}
        />
      ) : (
        <ListView
          milestones={milestones}
          dependencies={dependencies}
          teams={teams}
          projectId={selectedProjectId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkPriorityChange={handleBulkPriorityChange}
          onBulkDelete={handleBulkDelete}
          onBulkTeamChange={handleBulkTeamChange}
        />
      )}

      {/* Create/Edit Dialog */}
      <ItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMilestone(null);
        }}
        item={editingMilestone}
        teams={teams}
        onSave={handleCreateOrUpdate}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
