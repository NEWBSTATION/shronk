"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FeaturesDataTable } from "./data-table";
import { columns } from "./columns";
import { Layers, Plus } from "lucide-react";
import { FeatureDialog } from "@/components/milestone/feature-dialog";
import { useHeader } from "@/components/header-context";
import type { MilestoneStatus } from "@/db/schema";

interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: "not_started" | "in_progress" | "on_hold" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;
  teamId: string | null;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestoneName: string;
}

interface MilestoneOption {
  id: string;
  name: string;
}

interface FeaturesResponse {
  features: Feature[];
  milestones: MilestoneOption[];
}

async function fetchFeatures(): Promise<FeaturesResponse> {
  const response = await fetch("/api/features");
  if (!response.ok) {
    throw new Error("Failed to fetch features");
  }
  return response.json();
}

export function FeaturesView() {
  const queryClient = useQueryClient();
  const { setHeaderAction, clearHeaderAction } = useHeader();
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["allFeatures"],
    queryFn: fetchFeatures,
  });

  const features = data?.features || [];
  const milestoneOptions = data?.milestones || [];

  // Set header action for New Feature button
  useEffect(() => {
    if (milestoneOptions.length > 0) {
      setHeaderAction(
        <Button
          onClick={() => {
            setSelectedMilestoneId(milestoneOptions[0]?.id || null);
            setFeatureDialogOpen(true);
          }}
          className="h-7 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Feature
        </Button>
      );
    } else {
      clearHeaderAction();
    }

    return () => clearHeaderAction();
  }, [milestoneOptions, setHeaderAction, clearHeaderAction]);

  const createFeatureMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      title: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      status: MilestoneStatus;
    }) => {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allFeatures"] });
      toast.success("Feature created");
      setFeatureDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to create feature");
    },
  });

  const handleSaveFeature = (formData: {
    title: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    status: MilestoneStatus;
    teamId?: string | null;
  }) => {
    if (!selectedMilestoneId) return;

    createFeatureMutation.mutate({
      projectId: selectedMilestoneId,
      ...formData,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Failed to load features</p>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Layers className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No features yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create a milestone first, then add features to it to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeaturesDataTable
        columns={columns}
        data={features}
        milestoneOptions={milestoneOptions}
      />

      <FeatureDialog
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        feature={null}
        teams={[]}
        onSave={handleSaveFeature}
        isLoading={createFeatureMutation.isPending}
        milestoneOptions={milestoneOptions}
        selectedMilestoneId={selectedMilestoneId}
        onMilestoneChange={setSelectedMilestoneId}
      />
    </div>
  );
}
