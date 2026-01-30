"use client";

import { Button } from "@/components/ui/button";
import { MilestoneCard } from "./milestone-card";
import { Plus, Target } from "lucide-react";
import type { Project } from "@/db/schema";

interface MilestoneStats {
  milestoneId: string;
  featureCount: number;
  completedFeatureCount: number;
}

interface MilestoneOverviewProps {
  milestones: Project[];
  stats: MilestoneStats[];
  onSelectMilestone: (milestoneId: string) => void;
  onCreateMilestone: () => void;
}

export function MilestoneOverview({
  milestones,
  stats,
  onSelectMilestone,
  onCreateMilestone,
}: MilestoneOverviewProps) {
  const getStats = (milestoneId: string) => {
    return (
      stats.find((s) => s.milestoneId === milestoneId) || {
        featureCount: 0,
        completedFeatureCount: 0,
      }
    );
  };

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Target className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No milestones yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Create your first milestone to start organizing features and tracking
          progress.
        </p>
        <Button className="mt-4" onClick={onCreateMilestone}>
          <Plus className="h-4 w-4 mr-2" />
          Create Milestone
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {milestones.map((milestone) => {
          const { featureCount, completedFeatureCount } = getStats(milestone.id);
          return (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              featureCount={featureCount}
              completedFeatureCount={completedFeatureCount}
              onClick={() => onSelectMilestone(milestone.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
