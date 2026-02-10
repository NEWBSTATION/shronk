"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MilestoneOverview } from "@/components/milestone";
import { MilestoneDialog } from "@/components/milestone/milestone-dialog";
import { MilestoneDetailPanel } from "@/components/drilldown/panels/milestone-detail-panel";
import { useDrilldown } from "@/components/drilldown/drilldown-context";
import { useProjects, useMilestoneStats } from "@/hooks/use-milestones";

export function MilestonesTab() {
  const { push } = useDrilldown();
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];
  const { data: statsData } = useMilestoneStats();
  const stats = statsData?.stats || [];

  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);

  const handleSelectMilestone = useCallback(
    (milestoneId: string) => {
      const milestone = projects.find((p) => p.id === milestoneId);
      if (milestone) {
        push(
          `milestone-${milestoneId}`,
          <MilestoneDetailPanel milestone={milestone} />
        );
      }
    },
    [projects, push]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 py-4 md:py-6 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-medium">Milestones</h1>
          <Button
            onClick={() => setMilestoneDialogOpen(true)}
            className="h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Milestone
          </Button>
        </div>

        <MilestoneOverview
          milestones={projects}
          stats={stats}
          onSelectMilestone={handleSelectMilestone}
          onCreateMilestone={() => setMilestoneDialogOpen(true)}
        />
      </div>

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
      />
    </div>
  );
}
