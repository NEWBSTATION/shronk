"use client";

import { useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Plus, Calendar, Box, ArrowLeft, Ellipsis } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeatureDetailPanel } from "./feature-detail-panel";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { ColorIconPicker } from "@/components/features-list/color-icon-picker";
import { MilestoneIcon } from "@/lib/milestone-icon";
import { getColorStyles } from "@/lib/milestone-theme";
import {
  useMilestones,
  useTeams,
  useDependencies,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from "@/hooks/use-milestones";
import type { Project, Milestone, MilestoneStatus } from "@/db/schema";

interface MilestoneDetailPanelProps {
  milestone: Project;
}

export function MilestoneDetailPanel({
  milestone,
}: MilestoneDetailPanelProps) {
  const { push, pop } = useDrilldown();
  const queryClient = useQueryClient();

  const { data: featuresData } = useMilestones({
    projectId: milestone.id,
    sortField: "sortOrder",
    sortDirection: "asc",
  });
  const features = useMemo(
    () => featuresData?.milestones ?? [],
    [featuresData?.milestones]
  );

  const { data: teamsData } = useTeams(milestone.id);
  const teams = useMemo(() => teamsData?.teams ?? [], [teamsData?.teams]);

  const { data: depsData } = useDependencies(milestone.id);
  const dependencies = useMemo(
    () => depsData?.dependencies ?? [],
    [depsData?.dependencies]
  );

  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
  const deleteMutation = useDeleteMilestone();

  const updateProjectMutation = useMutation({
    mutationFn: async (data: { id: string; color?: string; icon?: string }) => {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      queryClient.invalidateQueries({ queryKey: ["milestoneStats"] });
    },
  });

  const handleColorChange = useCallback(
    (color: string) => {
      updateProjectMutation.mutate({ id: milestone.id, color });
    },
    [updateProjectMutation, milestone.id]
  );

  const handleIconChange = useCallback(
    (icon: string) => {
      updateProjectMutation.mutate({ id: milestone.id, icon });
    },
    [updateProjectMutation, milestone.id]
  );

  const colorStyles = getColorStyles(milestone.color);

  const completedCount = features.filter(
    (f) => f.status === "completed"
  ).length;
  const progress =
    features.length > 0
      ? Math.round((completedCount / features.length) * 100)
      : 0;

  const handleEditFeature = useCallback(
    (feature: Milestone) => {
      push(
        `feature-${feature.id}`,
        <FeatureDetailPanel
          feature={feature}
          teams={teams}
          projectName={milestone.name}
          dependencies={dependencies}
          onUpdate={async (data) => {
            try {
              await updateMutation.mutateAsync(data);
              toast.success("Feature updated");
            } catch {
              toast.error("Failed to update feature");
            }
          }}
          onDelete={async (id) => {
            try {
              await deleteMutation.mutateAsync(id);
              toast.success("Feature deleted");
            } catch {
              toast.error("Failed to delete feature");
            }
          }}
        />
      );
    },
    [push, teams, milestone.name, dependencies, updateMutation, deleteMutation]
  );

  const handleAddFeature = useCallback(() => {
    push(
      "new-feature",
      <FeatureDetailPanel
        teams={teams}
        projectName={milestone.name}
        onCreate={(formData) => {
          createMutation.mutate(
            { projectId: milestone.id, ...formData },
            {
              onSuccess: () => toast.success("Feature added"),
              onError: () => toast.error("Failed to add feature"),
            }
          );
        }}
        isLoading={createMutation.isPending}
      />
    );
  }, [push, teams, milestone.name, milestone.id, createMutation]);

  return (
    <div className="p-8">
      {/* Navigation header — Dougly style: back left, menu right */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={pop}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Ellipsis className="h-4 w-4" />
        </Button>
      </div>

      {/* Milestone title — large heading */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ColorIconPicker
            color={milestone.color}
            icon={milestone.icon}
            onColorChange={handleColorChange}
            onIconChange={handleIconChange}
          >
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:opacity-80"
              style={{
                backgroundColor: colorStyles.iconBg,
                color: colorStyles.hex,
              }}
            >
              <MilestoneIcon name={milestone.icon} className="h-5 w-5" />
            </button>
          </ColorIconPicker>
          <h1 className="text-3xl font-bold">{milestone.name}</h1>
        </div>

        {/* Progress card */}
        {features.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {completedCount}/{features.length}
            </span>
          </div>
        )}

        {/* Add Feature button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddFeature}
          className="mt-4"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Feature
        </Button>
      </div>

      {/* Milestone info */}
      <div className="space-y-0.5 mb-6">
        {milestone.startDate && milestone.endDate && (
          <div className="flex items-start gap-3 py-1.5 rounded-md px-2 -mx-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="w-32 shrink-0 text-muted-foreground text-sm">Date range</span>
            <span className="flex-1 text-sm">
              {format(new Date(milestone.startDate), "MMM d, yyyy")} –{" "}
              {format(new Date(milestone.endDate), "MMM d, yyyy")}
            </span>
          </div>
        )}
      </div>

      {/* Feature list */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Features</h3>
        </div>

        {features.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Box className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No features yet
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleAddFeature}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Feature
            </Button>
          </div>
        ) : (
          features.map((feature) => {
            const dotClass =
              feature.status === "completed" ? "bg-emerald-500" :
              feature.status === "in_progress" ? "bg-blue-500" :
              feature.status === "on_hold" ? "bg-amber-500" :
              feature.status === "cancelled" ? "bg-zinc-400" :
              "bg-zinc-300";
            return (
              <button
                key={feature.id}
                onClick={() => handleEditFeature(feature)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-accent transition-colors group"
              >
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} />
                <span
                  className={
                    feature.status === "completed"
                      ? "text-sm text-muted-foreground line-through flex-1 truncate"
                      : "text-sm flex-1 truncate"
                  }
                >
                  {feature.title}
                </span>
                <span className="text-xs text-muted-foreground/60 shrink-0">
                  {feature.duration}d
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
